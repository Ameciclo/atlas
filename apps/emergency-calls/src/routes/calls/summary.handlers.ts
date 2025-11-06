import { and, eq, gte, lte, count, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { db, ensureConnection } from "../../db/index.js";
import { emergencyCalls } from "../../db/schema.js";
import type { AppRouteHandler } from "../../lib/types.js";
import type { 
	SummaryRoute, 
	CitiesRoute, 
	CityStatsRoute, 
	OutcomesRoute, 
	ProfilesRoute 
} from "./summary.routes.js";

export const summary: AppRouteHandler<SummaryRoute> = async (c) => {
	await ensureConnection();

	// Get total calls
	const [totalResult] = await db
		.select({ count: count() })
		.from(emergencyCalls);

	// Get data period
	const [periodResult] = await db
		.select({
			start: sql<string>`MIN(${emergencyCalls.date})::text`,
			end: sql<string>`MAX(${emergencyCalls.date})::text`,
		})
		.from(emergencyCalls);

	// Get calls per year
	const yearlyData = await db
		.select({
			year: sql<string>`EXTRACT(YEAR FROM ${emergencyCalls.date})::text`,
			count: count(),
		})
		.from(emergencyCalls)
		.groupBy(sql`EXTRACT(YEAR FROM ${emergencyCalls.date})`)
		.orderBy(sql`EXTRACT(YEAR FROM ${emergencyCalls.date})`);

	// Get municipalities count
	const [municipalitiesResult] = await db
		.select({
			count: sql<number>`COUNT(DISTINCT ${emergencyCalls.municipality})`,
		})
		.from(emergencyCalls);

	// Get top city
	const [topCityResult] = await db
		.select({
			municipality: emergencyCalls.municipality,
			count: count(),
		})
		.from(emergencyCalls)
		.groupBy(emergencyCalls.municipality)
		.orderBy(sql`COUNT(*) DESC`)
		.limit(1);

	const callsPerYear = yearlyData.reduce((acc, item) => {
		acc[item.year] = item.count;
		return acc;
	}, {} as Record<string, number>);

	return c.json({
		total_calls: totalResult?.count || 0,
		data_period: {
			start: periodResult?.start?.split('T')[0] || '',
			end: periodResult?.end?.split('T')[0] || '',
		},
		calls_per_year: callsPerYear,
		municipalities_count: municipalitiesResult?.count || 0,
		top_city: {
			name: topCityResult?.municipality || '',
			total_calls: topCityResult?.count || 0,
		},
	});
};

export const cities: AppRouteHandler<CitiesRoute> = async (c) => {
	await ensureConnection();

	// Get total calls for percentage calculation
	const [totalResult] = await db
		.select({ count: count() })
		.from(emergencyCalls);

	// Get cities ranking
	const citiesData = await db
		.select({
			municipality: emergencyCalls.municipality,
			count: count(),
		})
		.from(emergencyCalls)
		.groupBy(emergencyCalls.municipality)
		.orderBy(sql`COUNT(*) DESC`);

	const cities = citiesData.map((city, index) => ({
		ranking: index + 1,
		municipality: city.municipality,
		total_calls: city.count,
		percentage: totalResult?.count ? 
			Number(((city.count / totalResult.count) * 100).toFixed(1)) : 0,
	}));

	return c.json({ cities });
};

export const cityStats: AppRouteHandler<CityStatsRoute> = async (c) => {
	await ensureConnection();
	const { city } = c.req.valid("param");

	// Get city ranking
	const citiesRanking = await db
		.select({
			municipality: emergencyCalls.municipality,
			count: count(),
		})
		.from(emergencyCalls)
		.groupBy(emergencyCalls.municipality)
		.orderBy(sql`COUNT(*) DESC`);

	const cityRanking = citiesRanking.findIndex(c => c.municipality === city) + 1;

	// Get yearly history for the city
	const yearlyData = await db
		.select({
			year: sql<string>`EXTRACT(YEAR FROM ${emergencyCalls.date})::text`,
			count: count(),
		})
		.from(emergencyCalls)
		.where(eq(emergencyCalls.municipality, city))
		.groupBy(sql`EXTRACT(YEAR FROM ${emergencyCalls.date})`)
		.orderBy(sql`EXTRACT(YEAR FROM ${emergencyCalls.date})`);

	const yearlyHistory = yearlyData.reduce((acc, item) => {
		acc[item.year] = item.count;
		return acc;
	}, {} as Record<string, number>);

	return c.json({
		city,
		ranking: cityRanking,
		yearly_history: yearlyHistory,
	});
};

export const outcomes: AppRouteHandler<OutcomesRoute> = async (c) => {
	await ensureConnection();
	const { city } = c.req.valid("query");

	// Get outcomes by year for the city
	const outcomesData = await db
		.select({
			year: sql<string>`EXTRACT(YEAR FROM ${emergencyCalls.date})::text`,
			outcome: emergencyCalls.outcome_category,
			count: count(),
		})
		.from(emergencyCalls)
		.where(eq(emergencyCalls.municipality, city))
		.groupBy(
			sql`EXTRACT(YEAR FROM ${emergencyCalls.date})`,
			emergencyCalls.outcome_category
		)
		.orderBy(sql`EXTRACT(YEAR FROM ${emergencyCalls.date})`);

	const outcomesByYear = outcomesData.reduce((acc, item) => {
		if (!acc[item.year]) {
			acc[item.year] = {};
		}
		acc[item.year][item.outcome || 'Unknown'] = item.count;
		return acc;
	}, {} as Record<string, Record<string, number>>);

	return c.json({
		city,
		outcomes_by_year: outcomesByYear,
	});
};

export const profiles: AppRouteHandler<ProfilesRoute> = async (c) => {
	await ensureConnection();
	const { city, start_year, end_year } = c.req.valid("query");

	// Build date conditions
	const conditions = [eq(emergencyCalls.municipality, city)];
	
	if (start_year) {
		conditions.push(gte(emergencyCalls.date, new Date(`${start_year}-01-01`)));
	}
	if (end_year) {
		conditions.push(lte(emergencyCalls.date, new Date(`${end_year}-12-31`)));
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

	// Get age group distribution
	const ageData = await db
		.select({
			age_group: sql<string>`
				CASE 
					WHEN ${emergencyCalls.age} < 18 THEN '0-17'
					WHEN ${emergencyCalls.age} BETWEEN 18 AND 29 THEN '18-29'
					WHEN ${emergencyCalls.age} BETWEEN 30 AND 49 THEN '30-49'
					WHEN ${emergencyCalls.age} BETWEEN 50 AND 64 THEN '50-64'
					ELSE '65+'
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
				WHEN ${emergencyCalls.age} BETWEEN 50 AND 64 THEN '50-64'
				ELSE '65+'
			END
		`);

	// Get type distribution
	const transportData = await db
		.select({
			type: emergencyCalls.type,
			count: count(),
		})
		.from(emergencyCalls)
		.where(whereClause)
		.groupBy(emergencyCalls.type);

	const byGender = genderData.reduce((acc, item) => {
		acc[item.gender || 'unknown'] = item.count;
		return acc;
	}, {} as Record<string, number>);

	const byAgeGroup = ageData.reduce((acc, item) => {
		acc[item.age_group] = item.count;
		return acc;
	}, {} as Record<string, number>);

	const byType = transportData.reduce((acc, item) => {
		acc[item.type || 'unknown'] = item.count;
		return acc;
	}, {} as Record<string, number>);

	return c.json({
		city,
		period: {
			start_year: start_year || new Date().getFullYear() - 5,
			end_year: end_year || new Date().getFullYear(),
		},
		by_gender: byGender,
		by_age_group: byAgeGroup,
		by_type: byType,
	});
};