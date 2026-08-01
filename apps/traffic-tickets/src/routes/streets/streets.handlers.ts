import { and, count, ilike, inArray, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { officialStreets, pcrStreets } from "../../db/schema.js";
import {
	violationsJoinedView,
	mvSpatialView,
	streetTopViolationView,
} from "../../db/views.js";
import type { AppRouteHandler } from "../../lib/types.js";
import type {
	listStreetsRoute,
	streetsGeoJSONRoute,
	streetsNearbyRoute,
} from "./streets.routes.js";

export const listStreets: AppRouteHandler<typeof listStreetsRoute> = async (
	c,
) => {
	const { page, limit, search } = c.req.valid("query");
	const offset = (page - 1) * limit;

	try {
		const conditions = [];
		if (search) {
			conditions.push(ilike(officialStreets.official_name, `%${search}%`));
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const [totalResult] = await db
			.select({ count: count() })
			.from(officialStreets)
			.where(whereClause);

		const total = totalResult?.count || 0;
		const totalPages = Math.ceil(total / limit);

		const streets = await db
			.select({
				id: officialStreets.id,
				code: officialStreets.code,
				name_concatenated: officialStreets.name_concatenated,
				official_name: officialStreets.official_name,
				short_name: officialStreets.short_name,
				pavement_code: officialStreets.pavement_code,
				pavement_description: officialStreets.pavement_description,
			})
			.from(officialStreets)
			.where(whereClause)
			.limit(limit)
			.offset(offset)
			.orderBy(officialStreets.official_name);

		return c.json(
			{
				data: streets,
				pagination: {
					page,
					limit,
					total,
					totalPages,
				},
			},
			200,
		);
	} catch (error) {
		console.error("Error fetching streets:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};

const CYCLIST_LAW_CODES = [
	"Art. 201",
	"Art. 181, Inc. VIII",
	"Art. 182, Inc. XI",
	"Art. 193",
	"Art. 220, Inc. XIII",
];

export const streetsGeoJSON: AppRouteHandler<
	typeof streetsGeoJSONRoute
> = async (c) => {
	const { category, law, cyclist, limit, simplify_tolerance } =
		c.req.valid("query");
	const resultLimit = limit ?? 100;
	const tolerance = simplify_tolerance ?? 0.0001;

	const hasFilter = !!(category || law || cyclist);

	const normalizedCyclistCodes = cyclist
		? CYCLIST_LAW_CODES.map((c) =>
				c.toLowerCase().replace(/\s+/g, "").replace(/'/g, "''"),
			)
		: [];

	let filterWhere = "";
	if (hasFilter) {
		const parts: string[] = ["mv.street_code IS NOT NULL"];
		if (category)
			parts.push(`mv.category = '${(category as string).replace(/'/g, "''")}'`);
		if (law) {
			const n = (law as string)
				.toLowerCase()
				.replace(/\s+/g, "")
				.replace(/'/g, "''");
			parts.push(
				`LOWER(REGEXP_REPLACE(mv.law_code, '\\s+', '', 'g')) LIKE '${n}%'`,
			);
		}
		if (cyclist && normalizedCyclistCodes.length) {
			const codes = normalizedCyclistCodes.map((c) => `'${c}'`).join(", ");
			parts.push(
				`LOWER(REGEXP_REPLACE(mv.law_code, '\\s+', '', 'g')) IN (${codes})`,
			);
		}
		filterWhere = parts.join(" AND ");
	}

	try {
		let streetData: any;
		let streetCodeList: number[];

		if (hasFilter) {
			streetData = await db.execute(sql`
				WITH top_streets AS (
					SELECT mv.street_code, COUNT(*)::int as total_violations
					FROM ${violationsJoinedView} mv
					WHERE ${sql.raw(filterWhere)}
					GROUP BY mv.street_code
					ORDER BY total_violations DESC
					LIMIT ${resultLimit}
				),
				yearly AS (
					SELECT mv.street_code,
						EXTRACT(YEAR FROM mv.violation_date)::int as year,
						COUNT(*)::int as count
					FROM ${violationsJoinedView} mv
					WHERE ${sql.raw(filterWhere)}
					  AND mv.street_code IN (SELECT street_code FROM top_streets)
					GROUP BY mv.street_code, EXTRACT(YEAR FROM mv.violation_date)
				)
				SELECT
					ts.street_code,
					sc.official_name as street_name,
					ts.total_violations,
					COALESCE(jsonb_object_agg(y.year::text, y.count) FILTER (WHERE y.year IS NOT NULL), '{}') as by_year
				FROM top_streets ts
				JOIN official_streets sc ON ts.street_code = sc.code
				LEFT JOIN yearly y ON ts.street_code = y.street_code
				GROUP BY ts.street_code, sc.official_name, ts.total_violations
				ORDER BY ts.total_violations DESC
			`);
		} else {
			streetData = await db.execute(sql`
				WITH street_yearly AS (
					SELECT street_code, year, SUM(count)::int as count
					FROM ${mvSpatialView} WHERE street_code IS NOT NULL
					GROUP BY street_code, year
				),
				all_time_top AS (
					SELECT street_code
					FROM street_yearly
					GROUP BY street_code
					ORDER BY SUM(count) DESC
					LIMIT ${resultLimit}
				),
				per_year_top AS (
					SELECT DISTINCT street_code FROM (
						SELECT street_code, ROW_NUMBER() OVER (PARTITION BY year ORDER BY count DESC) as rn
						FROM street_yearly
					) sub WHERE rn <= ${resultLimit}
				),
				all_codes AS (
					SELECT street_code FROM all_time_top
					UNION
					SELECT street_code FROM per_year_top
				)
				SELECT
					ac.street_code,
					sc.official_name as street_name,
					SUM(sy.count)::int as total_violations,
					jsonb_object_agg(sy.year::text, sy.count) as by_year
				FROM all_codes ac
				JOIN street_yearly sy ON ac.street_code = sy.street_code
				JOIN official_streets sc ON ac.street_code = sc.code
				GROUP BY ac.street_code, sc.official_name
				ORDER BY total_violations DESC
			`);
		}

		streetCodeList = (streetData.rows as any[]).map(
			(r) => r.street_code as number,
		);

		const [geoResults, lengthResults, topViolationResults] = await Promise.all([
			db
				.select({
					street_code: pcrStreets.clogra_codi,
					geometry:
						sql<string>`ST_AsGeoJSON(ST_Simplify(ST_Collect(${pcrStreets.coordinates}), ${tolerance}))`.as(
							"geometry",
						),
				})
				.from(pcrStreets)
				.where(inArray(pcrStreets.clogra_codi, streetCodeList))
				.groupBy(pcrStreets.clogra_codi),
			db
				.select({
					street_code: pcrStreets.clogra_codi,
					total_km: sql<number>`SUM(${pcrStreets.db2gse_sde}) / 1000.0`,
				})
				.from(pcrStreets)
				.where(inArray(pcrStreets.clogra_codi, streetCodeList))
				.groupBy(pcrStreets.clogra_codi),
			hasFilter
				? db.execute(sql`
					SELECT street_code, description, percentage FROM (
						SELECT mv.street_code,
							MAX(mv.canonical_description) as description,
							COUNT(*)::int as count,
							ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY mv.street_code), 1) as percentage,
							ROW_NUMBER() OVER (PARTITION BY mv.street_code ORDER BY COUNT(*) DESC) as rn
						FROM ${violationsJoinedView} mv
						WHERE mv.street_code = ANY(ARRAY[${sql.raw(streetCodeList.join(","))}]::int[])
						  AND ${sql.raw(filterWhere)}
						GROUP BY mv.street_code, mv.law_code
					) sub WHERE rn = 1
				`)
				: db
						.select({
							street_code: streetTopViolationView.streetCode,
							description: streetTopViolationView.description,
							percentage: streetTopViolationView.percentage,
						})
						.from(streetTopViolationView)
						.where(inArray(streetTopViolationView.streetCode, streetCodeList)),
		]);

		const geoMap = new Map<number, string>();
		for (const g of geoResults) {
			geoMap.set(g.street_code, g.geometry);
		}
		const lengthMap = new Map<number, number>();
		for (const l of lengthResults) {
			lengthMap.set(l.street_code, Number(l.total_km));
		}
		const topViolationMap = new Map<
			number,
			{ description: string; percentage: number }
		>();
		const tvRows = hasFilter
			? (topViolationResults as any).rows
			: topViolationResults;
		for (const row of tvRows) {
			topViolationMap.set(row.street_code, {
				description: row.description,
				percentage: Number(row.percentage),
			});
		}

		const features = (streetData.rows as any[]).map((s) => {
			const code = s.street_code as number;
			const totalKm = lengthMap.get(code) || 0;
			const geometry = geoMap.get(code);
			const parsed = geometry ? JSON.parse(geometry) : null;

			return {
				type: "Feature" as const,
				geometry: parsed?.type
					? parsed
					: { type: "MultiLineString", coordinates: [] },
				properties: {
					street_code: code,
					street_name: s.street_name as string,
					total_violations: Number(s.total_violations),
					extension_km: Math.round(totalKm * 100) / 100,
					violations_per_km:
						totalKm > 0
							? Math.round((Number(s.total_violations) / totalKm) * 100) / 100
							: 0,
					by_year: s.by_year || {},
					top_violation: topViolationMap.has(code)
						? {
								description: topViolationMap.get(code)!.description,
								percentage: topViolationMap.get(code)!.percentage,
							}
						: null,
				},
			};
		});

		return c.json({ type: "FeatureCollection" as const, features }, 200) as any;
	} catch (error) {
		console.error("Error fetching streets GeoJSON:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};

// @ts-expect-error - handler return type mismatch with route response schema
export const streetsNearby: AppRouteHandler<typeof streetsNearbyRoute> = async (
	c,
) => {
	const { lat, lng, radius, limit } = c.req.valid("query");

	try {
		const nearby = await db.execute(sql`
			SELECT
				ps.clogra_codi AS street_code,
				MIN(ST_Distance(
					ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
					ps.coordinates::geography
				)) AS distance_meters,
				ST_AsGeoJSON(ST_Simplify(ST_Collect(ps.coordinates), 0.0003)) AS geometry_json,
				SUM(ps.db2gse_sde) / 1000.0 AS extension_km
			FROM pcr_streets ps
			WHERE ST_DWithin(
				ps.coordinates::geography,
				ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
				${radius}
			)
			GROUP BY ps.clogra_codi
			ORDER BY distance_meters
			LIMIT ${limit}
		`);

		const rows = nearby.rows as any[];
		if (!rows.length) {
			return c.json({ type: "FeatureCollection", features: [] }, 200);
		}

		const streetCodes = rows.map((r) => r.street_code as number);

		const [namesResult, violResult, topVResult] = await Promise.all([
			db
				.select({
					code: officialStreets.code,
					name: officialStreets.official_name,
				})
				.from(officialStreets)
				.where(inArray(officialStreets.code, streetCodes)),
			db
				.select({
					street_code: violationsJoinedView.streetCode,
					count: sql<number>`COUNT(*)::int`,
				})
				.from(violationsJoinedView)
				.where(inArray(violationsJoinedView.streetCode, streetCodes))
				.groupBy(violationsJoinedView.streetCode),
			db
				.select({
					street_code: streetTopViolationView.streetCode,
					description: streetTopViolationView.description,
					percentage: streetTopViolationView.percentage,
				})
				.from(streetTopViolationView)
				.where(inArray(streetTopViolationView.streetCode, streetCodes)),
		]);

		const nameMap = new Map<number, string>();
		for (const n of namesResult) nameMap.set(n.code, n.name);

		const violMap = new Map<number, number>();
		for (const v of violResult) violMap.set(v.street_code!, v.count);

		const topVMap = new Map<
			number,
			{ description: string; percentage: number }
		>();
		for (const t of topVResult)
			topVMap.set(t.street_code, {
				description: t.description,
				percentage: Number(t.percentage),
			});

		const features = rows.map((r) => {
			const code = r.street_code as number;
			const extKm = Number(r.extension_km) || 0;
			const totalV = violMap.get(code) || 0;
			let geometry: any = { type: "MultiLineString", coordinates: [] };
			try {
				if (r.geometry_json) geometry = JSON.parse(r.geometry_json);
			} catch {
				// keep default
			}

			return {
				type: "Feature" as const,
				geometry,
				properties: {
					street_code: code,
					street_name: nameMap.get(code) || `Rua ${code}`,
					distance_meters: Math.round(Number(r.distance_meters) * 100) / 100,
					total_violations: totalV,
					extension_km: Math.round(extKm * 100) / 100,
					violations_per_km:
						extKm > 0 ? Math.round((totalV / extKm) * 100) / 100 : 0,
					by_year: {} as Record<string, number>,
					top_violation: topVMap.has(code)
						? {
								description: topVMap.get(code)!.description,
								percentage: topVMap.get(code)!.percentage,
							}
						: null,
				},
			};
		});

		return c.json({ type: "FeatureCollection" as const, features }, 200);
	} catch (error) {
		console.error("Error in streets nearby:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};
