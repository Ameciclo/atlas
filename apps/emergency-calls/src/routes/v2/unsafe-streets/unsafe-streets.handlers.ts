import { and, eq, count, sql } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { emergencyCalls, pcrStreets } from "../../../db/schema.js";
import type { AppRouteHandler } from "../../../lib/types.js";
import type {
	CitySummaryRoute,
	StreetSummaryRoute,
	CityConcentrationRoute,
	CityGeoJSONRoute,
	StreetProfilesRoute,
	StreetGeoJSONRoute,
	StreetEvolutionRoute,
	StreetRecordsRoute,
} from "./unsafe-streets.routes.js";

const genericPcrFilter = sql`${emergencyCalls.pcr_address} IS NOT NULL
	AND ${emergencyCalls.pcr_address} != ''
	AND UPPER(${emergencyCalls.pcr_address}) NOT IN ('NAO IDENTIFICADO', '#N/A', 'OUTRO MUNICIPIO')`;

function buildYearConditions(startYear?: number, endYear?: number) {
	const conditions: ReturnType<typeof sql>[] = [];
	if (startYear) conditions.push(sql`EXTRACT(YEAR FROM ${emergencyCalls.date}) >= ${startYear}`);
	if (endYear) conditions.push(sql`EXTRACT(YEAR FROM ${emergencyCalls.date}) <= ${endYear}`);
	return conditions;
}

export const citySummary: AppRouteHandler<CitySummaryRoute> = async (c) => {

	const { city } = c.req.valid("param");
	const { start_year, end_year } = c.req.valid("query");

	const cityConditions = [eq(emergencyCalls.municipality, city), ...buildYearConditions(start_year, end_year)];
	const cityWhere = and(...cityConditions);

	const [totalResult] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(emergencyCalls)
		.where(cityWhere);

	const yearlyData = await db
		.select({
			year: sql<string>`EXTRACT(YEAR FROM ${emergencyCalls.date})::text`,
			count: sql<number>`count(*)::int`,
		})
		.from(emergencyCalls)
		.where(cityWhere)
		.groupBy(sql`EXTRACT(YEAR FROM ${emergencyCalls.date})`)
		.orderBy(sql`EXTRACT(YEAR FROM ${emergencyCalls.date})`);

	const [streetsResult] = await db
		.select({
			count: sql<number>`COUNT(DISTINCT ${emergencyCalls.address})`,
		})
		.from(emergencyCalls)
		.where(cityWhere);

	const topStreetConditions = [eq(emergencyCalls.municipality, city), genericPcrFilter, ...buildYearConditions(start_year, end_year)];

	const [topStreetResult] = await db
		.select({
			location: emergencyCalls.pcr_address,
			count: sql<number>`count(*)::int`,
		})
		.from(emergencyCalls)
		.where(and(...topStreetConditions))
		.groupBy(emergencyCalls.pcr_address)
		.orderBy(sql`COUNT(*) DESC`)
		.limit(1);

	let extensaoTotalKm: number | undefined;

	try {
		let extensaoSql = sql`
			SELECT COALESCE(SUM(ps.db2gse_sde), 0) / 1000.0 AS extensao_km
			FROM pcr_streets ps
			WHERE ps.nlogra_conc IN (
				SELECT DISTINCT ps2.nlogra_conc
				FROM pcr_streets ps2
				INNER JOIN emergency_calls ec ON ec.pcr_street_id = ps2.id
				WHERE ec.municipality = ${city}
				  AND ec.pcr_street_id IS NOT NULL
		`;
		if (start_year) {
			extensaoSql = sql`${extensaoSql} AND EXTRACT(YEAR FROM ec.date) >= ${start_year}`;
		}
		if (end_year) {
			extensaoSql = sql`${extensaoSql} AND EXTRACT(YEAR FROM ec.date) <= ${end_year}`;
		}
		extensaoSql = sql`${extensaoSql} )`;
		const result = await db.execute(extensaoSql);
		const rows = (result as { rows?: Record<string, unknown>[] }).rows;
		if (rows?.[0]?.extensao_km != null) {
			extensaoTotalKm = Number(rows[0].extensao_km);
		}
	} catch {
		extensaoTotalKm = undefined;
	}

	const accidentsPerYear = yearlyData.reduce(
		(acc, item) => {
			acc[item.year] = Number(item.count);
			return acc;
		},
		{} as Record<string, number>,
	);

	const years = Object.keys(accidentsPerYear).map(Number).filter((y) => !Number.isNaN(y));
	const period = {
		start_year: Math.min(...years),
		end_year: Math.max(...years),
	};

	return c.json({
		city,
		total_accidents: Number(totalResult?.count || 0),
		accidents_per_year: accidentsPerYear,
		total_streets: Number(streetsResult?.count || 0),
		extensaoTotalKm,
		period,
		most_dangerous_street: {
			name: topStreetResult?.location || "",
			total_accidents: Number(topStreetResult?.count || 0),
		},
	});
};

export const streetSummary: AppRouteHandler<StreetSummaryRoute> = async (c) => {

	const { street_name } = c.req.valid("param");
	const { city } = c.req.valid("query");

	// Build conditions
	const conditions = [
		sql`${emergencyCalls.pcr_address} ILIKE ${`%${street_name}%`}`,
	];

	if (city) {
		conditions.push(eq(emergencyCalls.municipality, city));
	}

	const whereClause = and(...conditions);

	// Get total victims
	const [totalResult] = await db
		.select({ count: count() })
		.from(emergencyCalls)
		.where(whereClause);

	// Get victims per year
	const yearlyData = await db
		.select({
			year: sql<string>`EXTRACT(YEAR FROM ${emergencyCalls.date})::text`,
			count: count(),
		})
		.from(emergencyCalls)
		.where(whereClause)
		.groupBy(sql`EXTRACT(YEAR FROM ${emergencyCalls.date})`)
		.orderBy(sql`EXTRACT(YEAR FROM ${emergencyCalls.date})`);

	const victimsPerYear = yearlyData.reduce(
		(acc, item) => {
			acc[item.year] = item.count;
			return acc;
		},
		{} as Record<string, number>,
	);

	let streetExtensionKm: number | undefined;
	try {
		let extensionQuery = sql`
			SELECT COALESCE(SUM(ps.db2gse_sde), 0) / 1000.0 AS extension_km
			FROM pcr_streets ps
			WHERE ps.nlogra_conc IN (
				SELECT DISTINCT ps2.nlogra_conc
				FROM emergency_calls ec
				INNER JOIN pcr_streets ps2 ON ec.pcr_street_id = ps2.id
				WHERE ec.pcr_address ILIKE ${'%' + street_name + '%'}
				  AND ec.pcr_street_id IS NOT NULL
		`;
		if (city) {
			extensionQuery = sql`${extensionQuery} AND ec.municipality = ${city}`;
		}
		extensionQuery = sql`${extensionQuery} )`;
		const result = await db.execute(extensionQuery);
		const rows = (result as { rows?: Record<string, unknown>[] }).rows;
		if (rows?.[0]?.extension_km != null) {
			streetExtensionKm = Number(rows[0].extension_km);
		}
	} catch {
		streetExtensionKm = undefined;
	}

	return c.json({
		street_name,
		total_victims: totalResult?.count || 0,
		victims_per_year: victimsPerYear,
		street_extension_km: streetExtensionKm,
	});
};

export const cityConcentration: AppRouteHandler<
	CityConcentrationRoute
> = async (c) => {

	const { city } = c.req.valid("param");
	const { interval = 10, start_year, end_year } = c.req.valid("query");

	const topStreetConditions = [eq(emergencyCalls.municipality, city), genericPcrFilter, ...buildYearConditions(start_year, end_year)];

	// Get top streets by accident count
	const topStreets = await db
		.select({
			location: emergencyCalls.pcr_address,
			count: sql<number>`count(*)::int`,
		})
		.from(emergencyCalls)
		.where(and(...topStreetConditions))
		.groupBy(emergencyCalls.pcr_address)
		.orderBy(sql`COUNT(*) DESC`)
		.limit(interval);

	// Build pcr_address -> nlogra_conc mapping via FK
	const pcrAddressMap: Record<string, string> = {};
	try {
		const mappingRows = await db
			.select({
				pcr_address: emergencyCalls.pcr_address,
				nlogra_conc: pcrStreets.nlogra_conc,
			})
			.from(emergencyCalls)
			.innerJoin(pcrStreets, eq(emergencyCalls.pcr_street_id, pcrStreets.id))
			.where(and(
				eq(emergencyCalls.municipality, city),
				sql`${emergencyCalls.pcr_street_id} IS NOT NULL`,
			))
			.groupBy(emergencyCalls.pcr_address, pcrStreets.nlogra_conc);
		for (const row of mappingRows) {
			const addr = row.pcr_address;
			if (addr && !pcrAddressMap[addr]) {
				pcrAddressMap[addr] = row.nlogra_conc;
			}
		}
	} catch {
		// pcr_streets may not be available
	}

	// Load PCR extensions by nlogra_conc
	const pcrExtensions: Record<string, number> = {};
	try {
		const pcrData = await db
			.select({
				street_name: pcrStreets.nlogra_conc,
				extension_km: sql<number>`COALESCE(SUM(${pcrStreets.db2gse_sde}) / 1000.0, 0)`,
			})
			.from(pcrStreets)
			.groupBy(pcrStreets.nlogra_conc);
		for (const pcr of pcrData) {
			pcrExtensions[pcr.street_name] = pcr.extension_km;
		}
	} catch {
		// pcr_streets may not be available
	}

	const concentrationData = topStreets.map((street, index) => {
		const streetLocation = street.location || "";
		const pcrName = pcrAddressMap[streetLocation];
		return {
			ranking: index + 1,
			total_accidents: street.count,
			street_extension_km: pcrName ? pcrExtensions[pcrName] : undefined,
		};
	});

	return c.json({
		city,
		interval,
		concentration_data: concentrationData,
	});
};

export const cityGeoJSON: AppRouteHandler<CityGeoJSONRoute> = async (c) => {

	const { city } = c.req.valid("param");
	const { ranking_from = 1, ranking_to = 10, start_year, end_year } = c.req.valid("query");

	const topStreetConditions = [eq(emergencyCalls.municipality, city), genericPcrFilter, ...buildYearConditions(start_year, end_year)];

	const topStreets = await db
		.select({
			location: emergencyCalls.pcr_address,
			count: sql<number>`count(*)::int`,
		})
		.from(emergencyCalls)
		.where(and(...topStreetConditions))
		.groupBy(emergencyCalls.pcr_address)
		.orderBy(sql`COUNT(*) DESC`)
		.limit(ranking_to)
		.offset(ranking_from - 1);

	// Build pcr_address -> nlogra_conc mapping via FK
	const pcrAddressMap: Record<string, string> = {};
	try {
		const mappingRows = await db
			.select({
				pcr_address: emergencyCalls.pcr_address,
				nlogra_conc: pcrStreets.nlogra_conc,
			})
			.from(emergencyCalls)
			.innerJoin(pcrStreets, eq(emergencyCalls.pcr_street_id, pcrStreets.id))
			.where(and(
				eq(emergencyCalls.municipality, city),
				sql`${emergencyCalls.pcr_street_id} IS NOT NULL`,
			))
			.groupBy(emergencyCalls.pcr_address, pcrStreets.nlogra_conc);
		for (const row of mappingRows) {
			const addr = row.pcr_address;
			if (addr && !pcrAddressMap[addr]) {
				pcrAddressMap[addr] = row.nlogra_conc;
			}
		}
	} catch {
		// pcr_streets may not be available
	}

	const pcrGeoMap: Record<string, { geometry: unknown; extension: number }> = {};
	try {
		const pcrGeoData = await db
			.select({
				street_name: pcrStreets.nlogra_conc,
				geometry_json: sql<string>`ST_AsGeoJSON(ST_Collect(${pcrStreets.coordinates}))`,
				extension_km: sql<number>`COALESCE(SUM(${pcrStreets.db2gse_sde}) / 1000.0, 0)`,
			})
			.from(pcrStreets)
			.groupBy(pcrStreets.nlogra_conc);
		for (const pcr of pcrGeoData) {
			let geometry: unknown = { type: "LineString", coordinates: [] };
			try {
				geometry = JSON.parse(pcr.geometry_json);
			} catch {
				// keep default
			}
			pcrGeoMap[pcr.street_name] = { geometry, extension: pcr.extension_km };
		}
	} catch {
		// pcr_streets may not be available
	}

	const features = topStreets.map((street, index) => {
		const streetLocation = street.location || "Unknown";
		const pcrName = pcrAddressMap[streetLocation];
		const pcrData = pcrName ? pcrGeoMap[pcrName] : undefined;

		return {
			type: "Feature" as const,
			geometry: pcrData?.geometry as { type: string; coordinates?: unknown } || { type: "LineString", coordinates: [] },
			properties: {
				accidents_count: street.count,
				ranking: ranking_from + index,
				street_name: streetLocation,
				extension_km: pcrData?.extension,
			},
		};
	});

	return c.json({
		type: "FeatureCollection" as const,
		features,
	});
};

export const streetProfiles: AppRouteHandler<StreetProfilesRoute> = async (
	c,
) => {

	const { street_name } = c.req.valid("param");
	const { city } = c.req.valid("query");

	const conditions = [
		sql`${emergencyCalls.pcr_address} ILIKE ${`%${street_name}%`}`,
	];

	if (city) {
		conditions.push(eq(emergencyCalls.municipality, city));
	}

	const whereClause = and(...conditions);

	// Get gender distribution
	const genderData = await db
		.select({
			gender: emergencyCalls.gender,
			count: count(),
		})
		.from(emergencyCalls)
		.where(whereClause)
		.groupBy(emergencyCalls.gender);

	// Get age group distribution (simplified)
	const ageData = await db
		.select({
			age_group: sql<string>`
				CASE 
					WHEN ${emergencyCalls.age} < 18 THEN '0-17'
					WHEN ${emergencyCalls.age} BETWEEN 18 AND 29 THEN '18-29'
					WHEN ${emergencyCalls.age} BETWEEN 30 AND 49 THEN '30-49'
					WHEN ${emergencyCalls.age} >= 50 THEN '50+'
					ELSE 'unknown'
				END
			`,
			count: count(),
		})
		.from(emergencyCalls)
		.where(whereClause)
		.groupBy(sql`
			CASE 
				WHEN ${emergencyCalls.age} < 18 THEN '0-17'
				WHEN ${emergencyCalls.age} BETWEEN 18 AND 29 THEN '18-29'
				WHEN ${emergencyCalls.age} BETWEEN 30 AND 49 THEN '30-49'
				WHEN ${emergencyCalls.age} >= 50 THEN '50+'
				ELSE 'unknown'
			END
		`);

	// Get accident type distribution
	const typeData = await db
		.select({
			type: emergencyCalls.subtype,
			count: count(),
		})
		.from(emergencyCalls)
		.where(whereClause)
		.groupBy(emergencyCalls.subtype);

	const byGender = genderData.reduce(
		(acc, item) => {
			if (item.gender) acc[item.gender] = item.count;
			return acc;
		},
		{} as Record<string, number>,
	);

	const byAgeGroup = ageData.reduce(
		(acc, item) => {
			acc[item.age_group] = item.count;
			return acc;
		},
		{} as Record<string, number>,
	);

	const byAccidentType = typeData.reduce(
		(acc, item) => {
			if (item.type) acc[item.type] = item.count;
			return acc;
		},
		{} as Record<string, number>,
	);

	return c.json({
		street_name,
		victim_profiles: {
			by_gender: byGender,
			by_age_group: byAgeGroup,
			by_accident_type: byAccidentType,
		},
	});
};

export const streetGeoJSON: AppRouteHandler<StreetGeoJSONRoute> = async (c) => {

	const { street_name } = c.req.valid("param");
	const { city } = c.req.valid("query");

	const conditions = [
		sql`${emergencyCalls.pcr_address} ILIKE ${`%${street_name}%`}`,
	];

	if (city) {
		conditions.push(eq(emergencyCalls.municipality, city));
	}

	const whereClause = and(...conditions);

	const [result] = await db
		.select({ count: count() })
		.from(emergencyCalls)
		.where(whereClause);

	let geometry: { type: string; coordinates?: unknown } = {
		type: "LineString",
		coordinates: [],
	};
	let extensionKm: number | undefined;

	try {
		let geoQuery = sql`
			SELECT ST_AsGeoJSON(ST_Collect(pcr.coordinates)) AS geometry_json,
			       COALESCE(SUM(pcr.db2gse_sde) / 1000.0, 0) AS extension_km
			FROM pcr_streets pcr
			WHERE pcr.nlogra_conc IN (
				SELECT DISTINCT ps2.nlogra_conc
				FROM emergency_calls ec
				INNER JOIN pcr_streets ps2 ON ec.pcr_street_id = ps2.id
				WHERE ec.pcr_address ILIKE ${'%' + street_name + '%'}
				  AND ec.pcr_street_id IS NOT NULL
		`;
		if (city) {
			geoQuery = sql`${geoQuery} AND ec.municipality = ${city}`;
		}
		geoQuery = sql`${geoQuery} )`;
		const geoResult = await db.execute(geoQuery);
		const rows = (geoResult as { rows?: Record<string, unknown>[] }).rows;
		if (rows?.[0]) {
			if (rows[0].geometry_json) {
				try {
					geometry = JSON.parse(rows[0].geometry_json as string) as {
						type: string;
						coordinates?: unknown;
					};
				} catch {
					// keep default
				}
			}
			if (rows[0].extension_km != null) {
				extensionKm = Number(rows[0].extension_km);
			}
		}
	} catch {
		// pcr_streets may not be available
	}

	const features = [
		{
			type: "Feature" as const,
			geometry,
			properties: {
				street_name,
				accidents_count: result?.count || 0,
				extension_km: extensionKm,
			},
		},
	];

	return c.json({
		type: "FeatureCollection" as const,
		features,
	});
};

export const streetEvolution: AppRouteHandler<StreetEvolutionRoute> = async (
	c,
) => {

	const { street_name } = c.req.valid("param");
	const { city, start_year = 2020, end_year = 2022 } = c.req.valid("query");

	const conditions = [
		sql`${emergencyCalls.pcr_address} ILIKE ${`%${street_name}%`}`,
		sql`EXTRACT(YEAR FROM ${emergencyCalls.date}) >= ${start_year}`,
		sql`EXTRACT(YEAR FROM ${emergencyCalls.date}) <= ${end_year}`,
	];

	if (city) {
		conditions.push(eq(emergencyCalls.municipality, city));
	}

	const whereClause = and(...conditions);

	// Get monthly distribution
	const monthlyData = await db
		.select({
			month: sql<string>`LPAD(EXTRACT(MONTH FROM ${emergencyCalls.date})::text, 2, '0')`,
			count: count(),
		})
		.from(emergencyCalls)
		.where(whereClause)
		.groupBy(sql`EXTRACT(MONTH FROM ${emergencyCalls.date})`)
		.orderBy(sql`EXTRACT(MONTH FROM ${emergencyCalls.date})`);

	// Get weekday distribution
	const weekdayData = await db
		.select({
			weekday: sql<string>`
				CASE EXTRACT(DOW FROM ${emergencyCalls.date})
					WHEN 0 THEN 'domingo'
					WHEN 1 THEN 'segunda'
					WHEN 2 THEN 'terca'
					WHEN 3 THEN 'quarta'
					WHEN 4 THEN 'quinta'
					WHEN 5 THEN 'sexta'
					WHEN 6 THEN 'sabado'
				END
			`,
			count: count(),
		})
		.from(emergencyCalls)
		.where(whereClause)
		.groupBy(sql`EXTRACT(DOW FROM ${emergencyCalls.date})`);

	// Get hourly distribution (grouped)
	const hourlyData = await db
		.select({
			hour_group: sql<string>`
				CASE 
					WHEN EXTRACT(HOUR FROM ${emergencyCalls.time_minute}::time) BETWEEN 6 AND 9 THEN '06-09'
					WHEN EXTRACT(HOUR FROM ${emergencyCalls.time_minute}::time) BETWEEN 12 AND 14 THEN '12-14'
					WHEN EXTRACT(HOUR FROM ${emergencyCalls.time_minute}::time) BETWEEN 17 AND 19 THEN '17-19'
					ELSE 'outros'
				END
			`,
			count: count(),
		})
		.from(emergencyCalls)
		.where(whereClause)
		.groupBy(sql`
			CASE 
				WHEN EXTRACT(HOUR FROM ${emergencyCalls.time_minute}::time) BETWEEN 6 AND 9 THEN '06-09'
				WHEN EXTRACT(HOUR FROM ${emergencyCalls.time_minute}::time) BETWEEN 12 AND 14 THEN '12-14'
				WHEN EXTRACT(HOUR FROM ${emergencyCalls.time_minute}::time) BETWEEN 17 AND 19 THEN '17-19'
				ELSE 'outros'
			END
		`);

	const byMonth = monthlyData.reduce(
		(acc, item) => {
			acc[item.month] = item.count;
			return acc;
		},
		{} as Record<string, number>,
	);

	const byWeekday = weekdayData.reduce(
		(acc, item) => {
			acc[item.weekday] = item.count;
			return acc;
		},
		{} as Record<string, number>,
	);

	const byHour = hourlyData.reduce(
		(acc, item) => {
			acc[item.hour_group] = item.count;
			return acc;
		},
		{} as Record<string, number>,
	);

	return c.json({
		street_name,
		period: { start_year, end_year },
		by_month: byMonth,
		by_weekday: byWeekday,
		by_hour: byHour,
	});
};

export const streetRecords: AppRouteHandler<StreetRecordsRoute> = async (c) => {

	const { street_name } = c.req.valid("param");
	const { city, year } = c.req.valid("query");

	const conditions = [
		sql`${emergencyCalls.pcr_address} ILIKE ${`%${street_name}%`}`,
	];

	if (city) {
		conditions.push(eq(emergencyCalls.municipality, city));
	}

	if (year) {
		conditions.push(sql`EXTRACT(YEAR FROM ${emergencyCalls.date}) = ${year}`);
	}

	const whereClause = and(...conditions);

	const records = await db
		.select({
			date: emergencyCalls.date,
			time: emergencyCalls.time_minute,
			subtype: emergencyCalls.subtype,
			gender: emergencyCalls.gender,
			age: emergencyCalls.age,
			outcome: emergencyCalls.outcome_category,
		})
		.from(emergencyCalls)
		.where(whereClause)
		.orderBy(emergencyCalls.date, emergencyCalls.time_minute)
		.limit(100);

	const formattedRecords = records.map((record) => ({
		datetime: `${record.date}T${record.time || "00:00:00"}Z`,
		category: record.subtype || "UNKNOWN",
		gender: record.gender || "NÃO INFORMADO",
		age: record.age,
		outcome: record.outcome || "NÃO INFORMADO",
	}));

	return c.json({
		street_name,
		year,
		records: formattedRecords,
	});
};
