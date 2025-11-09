import { and, eq, count, sql } from "drizzle-orm";
import { db, ensureConnection } from "../../db/index.js";
import { emergencyCalls } from "../../db/schema.js";
import type { AppRouteHandler } from "../../lib/types.js";
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

export const citySummary: AppRouteHandler<CitySummaryRoute> = async (c) => {
	await ensureConnection();
	const { city } = c.req.valid("param");

	// Get total accidents in the city
	const [totalResult] = await db
		.select({ count: count() })
		.from(emergencyCalls)
		.where(eq(emergencyCalls.municipality, city));

	// Get accidents per year
	const yearlyData = await db
		.select({
			year: sql<string>`EXTRACT(YEAR FROM ${emergencyCalls.date})::text`,
			count: count(),
		})
		.from(emergencyCalls)
		.where(eq(emergencyCalls.municipality, city))
		.groupBy(sql`EXTRACT(YEAR FROM ${emergencyCalls.date})`)
		.orderBy(sql`EXTRACT(YEAR FROM ${emergencyCalls.date})`);

	// Get total streets (approximate based on location descriptions)
	const [streetsResult] = await db
		.select({
			count: sql<number>`COUNT(DISTINCT ${emergencyCalls.address})`,
		})
		.from(emergencyCalls)
		.where(eq(emergencyCalls.municipality, city));

	// Get most dangerous street
	const [topStreetResult] = await db
		.select({
			location: emergencyCalls.address,
			count: count(),
		})
		.from(emergencyCalls)
		.where(eq(emergencyCalls.municipality, city))
		.groupBy(emergencyCalls.address)
		.orderBy(sql`COUNT(*) DESC`)
		.limit(1);

	const accidentsPerYear = yearlyData.reduce(
		(acc, item) => {
			acc[item.year] = item.count;
			return acc;
		},
		{} as Record<string, number>,
	);

	return c.json({
		city,
		total_accidents: totalResult?.count || 0,
		accidents_per_year: accidentsPerYear,
		total_streets: streetsResult?.count || 0,
		most_dangerous_street: {
			name: topStreetResult?.location || "",
			total_accidents: topStreetResult?.count || 0,
		},
	});
};

export const streetSummary: AppRouteHandler<StreetSummaryRoute> = async (c) => {
	await ensureConnection();
	const { street_name } = c.req.valid("param");
	const { city } = c.req.valid("query");

	// Build conditions
	const conditions = [
		sql`${emergencyCalls.address} ILIKE ${`%${street_name}%`}`,
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

	return c.json({
		street_name,
		total_victims: totalResult?.count || 0,
		victims_per_year: victimsPerYear,
		street_extension_km: 8.5, // Mock data - would need actual street data
	});
};

export const cityConcentration: AppRouteHandler<
	CityConcentrationRoute
> = async (c) => {
	await ensureConnection();
	const { city } = c.req.valid("param");
	const { interval = 10 } = c.req.valid("query");

	// Get top streets by accident count
	const topStreets = await db
		.select({
			location: emergencyCalls.address,
			count: count(),
		})
		.from(emergencyCalls)
		.where(eq(emergencyCalls.municipality, city))
		.groupBy(emergencyCalls.address)
		.orderBy(sql`COUNT(*) DESC`)
		.limit(interval);

	const concentrationData = topStreets.map((street, index) => ({
		ranking: index + 1,
		total_accidents: street.count,
		street_extension_km: Math.random() * 10 + 1, // Mock data
	}));

	return c.json({
		city,
		interval,
		concentration_data: concentrationData,
	});
};

export const cityGeoJSON: AppRouteHandler<CityGeoJSONRoute> = async (c) => {
	await ensureConnection();
	const { city } = c.req.valid("param");
	const { ranking_from = 1, ranking_to = 10 } = c.req.valid("query");

	// Get top streets by accident count
	const topStreets = await db
		.select({
			location: emergencyCalls.address,
			count: count(),
		})
		.from(emergencyCalls)
		.where(eq(emergencyCalls.municipality, city))
		.groupBy(emergencyCalls.address)
		.orderBy(sql`COUNT(*) DESC`)
		.limit(ranking_to)
		.offset(ranking_from - 1);

	const features = topStreets.map((street, index) => ({
		type: "Feature" as const,
		geometry: {
			type: "LineString",
			coordinates: [
				[-34.8813, -8.0476],
				[-34.882, -8.048],
			], // Mock coordinates
		},
		properties: {
			accidents_count: street.count,
			ranking: ranking_from + index,
			extension_km: Math.random() * 10 + 1,
			street_name: street.location || "Unknown",
		},
	}));

	return c.json({
		type: "FeatureCollection" as const,
		features,
	});
};

export const streetProfiles: AppRouteHandler<StreetProfilesRoute> = async (
	c,
) => {
	await ensureConnection();
	const { street_name } = c.req.valid("param");
	const { city } = c.req.valid("query");

	const conditions = [
		sql`${emergencyCalls.address} ILIKE ${`%${street_name}%`}`,
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
	await ensureConnection();
	const { street_name } = c.req.valid("param");
	const { city } = c.req.valid("query");

	const conditions = [
		sql`${emergencyCalls.address} ILIKE ${`%${street_name}%`}`,
	];

	if (city) {
		conditions.push(eq(emergencyCalls.municipality, city));
	}

	const whereClause = and(...conditions);

	const [result] = await db
		.select({ count: count() })
		.from(emergencyCalls)
		.where(whereClause);

	const features = [
		{
			type: "Feature" as const,
			geometry: {
				type: "LineString",
				coordinates: [
					[-34.8813, -8.0476],
					[-34.882, -8.048],
				], // Mock coordinates
			},
			properties: {
				street_name,
				accidents_count: result?.count || 0,
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
	await ensureConnection();
	const { street_name } = c.req.valid("param");
	const { city, start_year = 2020, end_year = 2022 } = c.req.valid("query");

	const conditions = [
		sql`${emergencyCalls.address} ILIKE ${`%${street_name}%`}`,
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
	await ensureConnection();
	const { street_name } = c.req.valid("param");
	const { city, year } = c.req.valid("query");

	const conditions = [
		sql`${emergencyCalls.address} ILIKE ${`%${street_name}%`}`,
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
