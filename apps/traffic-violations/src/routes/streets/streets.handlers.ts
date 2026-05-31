import {
	and,
	count,
	desc,
	eq,
	gte,
	ilike,
	inArray,
	lte,
	sql,
} from "drizzle-orm";
import { db } from "../../db/index.js";
import {
	streetCodes,
	pcrStreets,
	trafficViolations,
} from "../../db/schema.js";
import {
	buildConditions,
} from "../../lib/query-helpers.js";
import type { AppRouteHandler } from "../../lib/types.js";
import type {
	getStreetRoute,
	listStreetsRoute,
	neighborhoodsRoute,
	streetSummaryRoute,
	streetsGeoJSONRoute,
	streetsRankingRoute,
	streetViolationsRoute,
} from "./streets.routes.js";

export const listStreets: AppRouteHandler<typeof listStreetsRoute> = async (
	c,
) => {
	const { page, limit, search } = c.req.valid("query");
	const offset = (page - 1) * limit;

	try {
		// Build where conditions
		const conditions = [];
		if (search) {
			conditions.push(ilike(streetCodes.official_name, `%${search}%`));
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		// Get total count
		const [totalResult] = await db
			.select({ count: count() })
			.from(streetCodes)
			.where(whereClause);

		const total = totalResult?.count || 0;
		const totalPages = Math.ceil(total / limit);

		// Get paginated data
		const streets = await db
			.select({
				id: streetCodes.id,
				code: streetCodes.code,
				name_concatenated: streetCodes.name_concatenated,
				official_name: streetCodes.official_name,
				short_name: streetCodes.short_name,
				pavement_code: streetCodes.pavement_code,
				pavement_description: streetCodes.pavement_description,
			})
			.from(streetCodes)
			.where(whereClause)
			.limit(limit)
			.offset(offset)
			.orderBy(streetCodes.official_name);

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

export const getStreet: AppRouteHandler<typeof getStreetRoute> = async (c) => {
	const { code } = c.req.valid("param");

	try {
		const [street] = await db
			.select()
			.from(streetCodes)
			.where(eq(streetCodes.code, code))
			.limit(1);

		if (!street) {
			return c.json({ error: "Street not found" }, 404);
		}

		return c.json(street, 200);
	} catch (error) {
		console.error("Error fetching street:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};

export const streetsRanking: AppRouteHandler<
	typeof streetsRankingRoute
> = async (c) => {
	const { start_date, end_date, violation_type_id, limit } =
		c.req.valid("query");

	try {
		// Build date conditions
		const conditions = [];
		if (start_date) {
			conditions.push(
				gte(trafficViolations.violation_date, new Date(start_date)),
			);
		}
		if (end_date) {
			conditions.push(
				lte(trafficViolations.violation_date, new Date(end_date)),
			);
		}
		if (violation_type_id) {
			conditions.push(
				eq(trafficViolations.violation_type_id, violation_type_id),
			);
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		// Get streets with violation counts
		const streetsWithViolations = await db
			.select({
				street_code: trafficViolations.street_code,
				official_name: streetCodes.official_name,
				short_name: streetCodes.short_name,
				total_violations: count(),
			})
			.from(trafficViolations)
			.innerJoin(
				streetCodes,
				eq(trafficViolations.street_code, streetCodes.code),
			)
			.where(whereClause)
			.groupBy(
				trafficViolations.street_code,
				streetCodes.official_name,
				streetCodes.short_name,
			)
			.orderBy(desc(count()))
			.limit(limit);

		// Fetch street lengths from pcr_streets
		const streetCodeList = streetsWithViolations
			.map((s) => s.street_code)
			.filter((c): c is number => c != null);

		let lengthMap = new Map<number, number>();

		if (streetCodeList.length > 0) {
			const lengths = await db
				.select({
					street_code: pcrStreets.clogra_codi,
					total_km: sql<number>`SUM(${pcrStreets.db2gse_sde}) / 1000.0`,
				})
				.from(pcrStreets)
				.where(inArray(pcrStreets.clogra_codi, streetCodeList))
				.groupBy(pcrStreets.clogra_codi);

			lengthMap = new Map(
				lengths.map((l) => [l.street_code, Number(l.total_km)]),
			);
		}

		const streets = streetsWithViolations.map((street, index) => {
			const totalKm = lengthMap.get(street.street_code || 0) || 0;
			const violationsPerKm =
				totalKm > 0
					? Math.round((street.total_violations / totalKm) * 100) / 100
					: 0;

			return {
				street_code: street.street_code || 0,
				official_name: street.official_name,
				short_name: street.short_name,
				total_violations: street.total_violations,
				ranking: index + 1,
				violations_per_km: violationsPerKm,
			};
		});

		return c.json({ streets }, 200) as any;
	} catch (error) {
		console.error("Error fetching streets ranking:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};

export const streetSummary: AppRouteHandler<typeof streetSummaryRoute> = async (
	c,
) => {
	const { street_code } = c.req.valid("param");

	try {
		// Get street info
		const [street] = await db
			.select({
				code: streetCodes.code,
				official_name: streetCodes.official_name,
			})
			.from(streetCodes)
			.where(eq(streetCodes.code, street_code))
			.limit(1);

		if (!street) {
			return c.json({ error: "Street not found" }, 404);
		}

		// Get total violations
		const [totalResult] = await db
			.select({ count: count() })
			.from(trafficViolations)
			.where(eq(trafficViolations.street_code, street_code));

		// Get violations per year
		const yearlyData = await db
			.select({
				year: sql<string>`EXTRACT(YEAR FROM ${trafficViolations.violation_date})::text`,
				count: count(),
			})
			.from(trafficViolations)
			.where(eq(trafficViolations.street_code, street_code))
			.groupBy(sql`EXTRACT(YEAR FROM ${trafficViolations.violation_date})`)
			.orderBy(sql`EXTRACT(YEAR FROM ${trafficViolations.violation_date})`);

		// Get top violation types
		const topTypes = await db
			.select({
				type_id: trafficViolations.violation_type_id,
				description: trafficViolations.description,
				count: count(),
			})
			.from(trafficViolations)
			.where(eq(trafficViolations.street_code, street_code))
			.groupBy(
				trafficViolations.violation_type_id,
				trafficViolations.description,
			)
			.orderBy(desc(count()))
			.limit(5);

		const violationsPerYear = yearlyData.reduce(
			(acc, item) => {
				acc[item.year] = item.count;
				return acc;
			},
			{} as Record<string, number>,
		);

		const topViolationTypes = topTypes.map((type) => ({
			type_id: type.type_id,
			description: type.description,
			count: type.count,
		}));

		return c.json(
			{
				street,
				violations_summary: {
					total_violations: totalResult?.count || 0,
					violations_per_year: violationsPerYear,
					top_violation_types: topViolationTypes,
				},
			},
			200,
		) as any;
	} catch (error) {
		console.error("Error fetching street summary:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};

export const streetViolations: AppRouteHandler<
	typeof streetViolationsRoute
> = async (c) => {
	const { street_code } = c.req.valid("param");
	const { start_date, end_date, violation_type_id, limit, offset } =
		c.req.valid("query");

	try {
		// Build conditions
		const conditions = [eq(trafficViolations.street_code, street_code)];
		if (start_date) {
			conditions.push(
				gte(trafficViolations.violation_date, new Date(start_date)),
			);
		}
		if (end_date) {
			conditions.push(
				lte(trafficViolations.violation_date, new Date(end_date)),
			);
		}
		if (violation_type_id) {
			conditions.push(
				eq(trafficViolations.violation_type_id, violation_type_id),
			);
		}

		const whereClause = and(...conditions);

		// Get total count
		const [totalResult] = await db
			.select({ count: count() })
			.from(trafficViolations)
			.where(whereClause);

		// Get violations
		const violations = await db
			.select({
				id: trafficViolations.id,
				date: sql<string>`${trafficViolations.violation_date}::date::text`,
				time: sql<string>`${trafficViolations.violation_date}::time::text`,
				violation_type_id: trafficViolations.violation_type_id,
				violation_description: trafficViolations.description,
				agent_id: trafficViolations.agent_id,
				location_id: trafficViolations.location_id,
				location_description: trafficViolations.location_description,
			})
			.from(trafficViolations)
			.where(whereClause)
			.orderBy(desc(trafficViolations.violation_date))
			.limit(limit)
			.offset(offset);

		return c.json(
			{
				data: violations,
				pagination: {
					limit,
					offset,
					total: totalResult?.count || 0,
				},
			},
			200,
		) as any;
	} catch (error) {
		console.error("Error fetching street violations:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};

export const neighborhoods: AppRouteHandler<typeof neighborhoodsRoute> = async (
	c,
) => {
	return c.json({ neighborhoods: [] }, 200) as any;
};

export const streetsGeoJSON: AppRouteHandler<
	typeof streetsGeoJSONRoute
> = async (c) => {
	const {
		violation_codes,
		category,
		agent_category,
		start_date,
		end_date,
		limit,
	} = c.req.valid("query");

	const resultLimit = limit ?? 50;

	try {
		const whereClause = await buildConditions({
			codes: violation_codes,
			category,
			agentCategory: agent_category,
			startDate: start_date,
			endDate: end_date,
		});

		// Step 1: Get top streets by violation count (no pcrStreets join).
		// This avoids count inflation from pcr street segments and is fast.
		const streetsData = await db
			.select({
				street_code: trafficViolations.street_code,
				street_name: streetCodes.official_name,
				total_violations: count(),
			})
			.from(trafficViolations)
			.innerJoin(
				streetCodes,
				eq(trafficViolations.street_code, streetCodes.code),
			)
			.where(whereClause)
			.groupBy(
				trafficViolations.street_code,
				streetCodes.official_name,
			)
			.orderBy(desc(count()))
			.limit(resultLimit);

		const streetCodeList = streetsData
			.map((s) => s.street_code)
			.filter((c): c is number => c != null);

		// Step 2: Get geometry and length from pcrStreets only for top streets.
		// Two separate queries because SUM(db2gse_sde) <> ST_Collect aggregates differently.
			const geoMap = new Map<number, string>();
		const lengthMap = new Map<number, number>();

		if (streetCodeList.length > 0) {
			const [geoResults, lengthResults] = await Promise.all([
				db
					.select({
						street_code: pcrStreets.clogra_codi,
						geometry:
							sql<string>`ST_AsGeoJSON(ST_Collect(${pcrStreets.coordinates}))`.as(
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
			]);

			for (const g of geoResults) {
				geoMap.set(g.street_code, g.geometry);
			}
			for (const l of lengthResults) {
				lengthMap.set(l.street_code, Number(l.total_km));
			}
		}

		const features = streetsData
			.map((s) => {
				const code = s.street_code ?? 0;
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
						street_name: s.street_name,
						total_violations: s.total_violations,
						extension_km: Math.round(totalKm * 100) / 100,
						violations_per_km:
							totalKm > 0
								? Math.round((s.total_violations / totalKm) * 100) / 100
								: 0,
					},
				};
			});

		return c.json({ type: "FeatureCollection" as const, features }, 200) as any;
	} catch (error) {
		console.error("Error fetching streets GeoJSON:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};
