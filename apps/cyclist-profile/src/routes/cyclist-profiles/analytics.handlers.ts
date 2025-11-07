import type { RouteHandler } from "@hono/zod-openapi";
import { sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { db } from "../../db/index.js";
import { cyclistProfiles } from "@atlas/database/schemas/cyclist-profile";
import type { AppBindings } from "../../lib/types.ts";
import type { SummaryRoute, TrendsRoute, GenderAnalysisRoute, SafetyAnalysisRoute, SurveyLocationsRoute } from "./analytics.routes.ts";

export const summary: RouteHandler<SummaryRoute, AppBindings> = async (c) => {
	try {
		const year = c.req.query("year") ? Number(c.req.query("year")) : undefined;
		
		const yearFilter = year ? sql`metadata->>'survey_year' = ${year.toString()}` : sql`1=1`;
	
	// Get total responses
	const [totalResult] = await db
		.select({ count: sql<number>`count(*)` })
		.from(cyclistProfiles)
		.where(yearFilter);
	
	// Demographics - Gender
	const genderStats = await db
		.select({
			gender: sql<string>`data->>'gender'`,
			count: sql<number>`count(*)`
		})
		.from(cyclistProfiles)
		.where(yearFilter)
		.groupBy(sql`data->>'gender'`);
	
	// Demographics - Age groups
	const ageStats = await db
		.select({
			age_category: sql<string>`data->>'age_category'`,
			count: sql<number>`count(*)`
		})
		.from(cyclistProfiles)
		.where(yearFilter)
		.groupBy(sql`data->>'age_category'`);
	
	// Demographics - Race
	const raceStats = await db
		.select({
			race: sql<string>`data->>'color_race'`,
			count: sql<number>`count(*)`
		})
		.from(cyclistProfiles)
		.where(yearFilter)
		.groupBy(sql`data->>'color_race'`);
	
	// Demographics - Education
	const educationStats = await db
		.select({
			education: sql<string>`data->>'schooling'`,
			count: sql<number>`count(*)`
		})
		.from(cyclistProfiles)
		.where(yearFilter)
		.groupBy(sql`data->>'schooling'`);
	
	// Demographics - Income
	const incomeStats = await db
		.select({
			income: sql<string>`data->>'age_standard'`,
			count: sql<number>`count(*)`
		})
		.from(cyclistProfiles)
		.where(yearFilter)
		.groupBy(sql`data->>'age_standard'`);
	
	// Usage patterns
	const [avgDaysResult] = await db
		.select({
			avg_days: sql<number>`avg((data->'days_usage'->>'total')::numeric)`
		})
		.from(cyclistProfiles)
		.where(yearFilter);
	
	const bikeTypeStats = await db
		.select({
			bike_type: sql<string>`metadata->>'bike_type'`,
			count: sql<number>`count(*)`
		})
		.from(cyclistProfiles)
		.where(yearFilter)
		.groupBy(sql`metadata->>'bike_type'`);
	
	// Motivations
	const motivationStartStats = await db
		.select({
			motivation: sql<string>`data->>'motivation_to_start'`,
			count: sql<number>`count(*)`
		})
		.from(cyclistProfiles)
		.where(yearFilter)
		.groupBy(sql`data->>'motivation_to_start'`);
	
	const motivationContinueStats = await db
		.select({
			motivation: sql<string>`data->>'motivation_to_continue'`,
			count: sql<number>`count(*)`
		})
		.from(cyclistProfiles)
		.where(yearFilter)
		.groupBy(sql`data->>'motivation_to_continue'`);
	
	// Issues
	const problemsStats = await db
		.select({
			problem: sql<string>`data->>'biggest_issue'`,
			count: sql<number>`count(*)`
		})
		.from(cyclistProfiles)
		.where(yearFilter)
		.groupBy(sql`data->>'biggest_issue'`);
	
	const needsStats = await db
		.select({
			need: sql<string>`data->>'frequency_what'`,
			count: sql<number>`count(*)`
		})
		.from(cyclistProfiles)
		.where(yearFilter)
		.groupBy(sql`data->>'frequency_what'`);
	
	const total = totalResult.count;
	
	const toPercentage = (stats: any[]) => 
		Object.fromEntries(
			stats
				.filter(s => s.count > 0 && s[Object.keys(s)[0]])
				.map(s => [s[Object.keys(s)[0]], Number(((s.count / total) * 100).toFixed(1))])
		);
	
	return c.json({
		year: year || "all",
		total_responses: total,
		demographics: {
			gender: toPercentage(genderStats),
			age_groups: toPercentage(ageStats),
			race: toPercentage(raceStats),
			education: toPercentage(educationStats),
			income: toPercentage(incomeStats)
		},
		usage_patterns: {
			avg_days_per_week: avgDaysResult.avg_days ? Number(Number(avgDaysResult.avg_days).toFixed(1)) : 0,
			bike_type: toPercentage(bikeTypeStats)
		},
		motivations: {
			to_start: toPercentage(motivationStartStats),
			to_continue: toPercentage(motivationContinueStats)
		},
		issues: {
			main_problems: toPercentage(problemsStats),
			what_would_make_cycle_more: toPercentage(needsStats)
		}
	}, HttpStatusCodes.OK);
	} catch (error) {
		console.error('Summary error:', error);
		return c.json({ error: error.message }, 500);
	}
};

export const trends: RouteHandler<TrendsRoute, AppBindings> = async (c) => {
	const years = c.req.query("years") || "2015,2018,2021,2024";
	const yearsList = years.split(",").map(y => parseInt(y.trim()));
	
	const trendsData = await Promise.all(
		yearsList.map(async (year) => {
			const [totalResult] = await db
				.select({ count: sql<number>`count(*)` })
				.from(cyclistProfiles)
				.where(sql`metadata->>'survey_year' = ${year.toString()}`);
			
			const genderStats = await db
				.select({
					gender: sql<string>`data->>'gender'`,
					count: sql<number>`count(*)`
				})
				.from(cyclistProfiles)
				.where(sql`metadata->>'survey_year' = ${year.toString()}`)
				.groupBy(sql`data->>'gender'`);
			
			const total = totalResult.count;
			const genderPercentages = Object.fromEntries(
				genderStats
					.filter(s => s.gender)
					.map(s => [s.gender, Number(((s.count / total) * 100).toFixed(1))])
			);
			
			return {
				year,
				total_responses: total,
				gender_distribution: genderPercentages
			};
		})
	);
	
	return c.json({ trends: trendsData }, HttpStatusCodes.OK);
};

export const genderAnalysis: RouteHandler<GenderAnalysisRoute, AppBindings> = async (c) => {
	const year = c.req.query("year") ? Number(c.req.query("year")) : undefined;
	const yearFilter = year ? sql`metadata->>'survey_year' = ${year.toString()}` : sql`1=1`;
	
	// Usage by gender
	const usageByGender = await db
		.select({
			gender: sql<string>`data->>'gender'`,
			avg_days: sql<number>`avg((data->'days_usage'->>'total')::numeric)`,
			count: sql<number>`count(*)`
		})
		.from(cyclistProfiles)
		.where(yearFilter)
		.groupBy(sql`data->>'gender'`);
	
	// Motivations by gender
	const motivationsByGender = await db
		.select({
			gender: sql<string>`data->>'gender'`,
			motivation: sql<string>`data->>'motivation_to_continue'`,
			count: sql<number>`count(*)`
		})
		.from(cyclistProfiles)
		.where(yearFilter)
		.groupBy(sql`data->>'gender'`, sql`data->>'motivation_to_continue'`);
	
	// Issues by gender
	const issuesByGender = await db
		.select({
			gender: sql<string>`data->>'gender'`,
			issue: sql<string>`data->>'biggest_issue'`,
			count: sql<number>`count(*)`
		})
		.from(cyclistProfiles)
		.where(yearFilter)
		.groupBy(sql`data->>'gender'`, sql`data->>'biggest_issue'`);
	
	return c.json({
		year: year || "all",
		usage_by_gender: usageByGender.filter(u => u.gender).map(u => ({
			gender: u.gender,
			avg_days_per_week: Number(u.avg_days?.toFixed(1)) || 0,
			total_responses: u.count
		})),
		motivations_by_gender: motivationsByGender
			.filter(m => m.gender && m.motivation)
			.reduce((acc, curr) => {
				if (!acc[curr.gender]) acc[curr.gender] = {};
				acc[curr.gender][curr.motivation] = curr.count;
				return acc;
			}, {} as any),
		issues_by_gender: issuesByGender
			.filter(i => i.gender && i.issue)
			.reduce((acc, curr) => {
				if (!acc[curr.gender]) acc[curr.gender] = {};
				acc[curr.gender][curr.issue] = curr.count;
				return acc;
			}, {} as any)
	}, HttpStatusCodes.OK);
};

export const safetyAnalysis: RouteHandler<SafetyAnalysisRoute, AppBindings> = async (c) => {
	const year = c.req.query("year") ? Number(c.req.query("year")) : undefined;
	const yearFilter = year ? sql`metadata->>'survey_year' = ${year.toString()}` : sql`1=1`;
	
	// Total responses
	const [totalResult] = await db
		.select({ count: sql<number>`count(*)` })
		.from(cyclistProfiles)
		.where(yearFilter);
	
	// Accidents overall
	const [accidentsResult] = await db
		.select({ count: sql<number>`count(*)` })
		.from(cyclistProfiles)
		.where(sql`${yearFilter} AND data->>'collisions' = 'Sim'`);
	
	// Accidents by gender
	const accidentsByGender = await db
		.select({
			gender: sql<string>`data->>'gender'`,
			accidents: sql<number>`count(*) filter (where data->>'collisions' = 'Sim')`,
			total: sql<number>`count(*)`
		})
		.from(cyclistProfiles)
		.where(yearFilter)
		.groupBy(sql`data->>'gender'`);
	
	// Theft analysis
	const [theftResult] = await db
		.select({ count: sql<number>`count(*)` })
		.from(cyclistProfiles)
		.where(sql`${yearFilter} AND data->>'theft_occurrence' != ''`);
	
	// Harassment analysis
	const [harassmentResult] = await db
		.select({ count: sql<number>`count(*)` })
		.from(cyclistProfiles)
		.where(sql`${yearFilter} AND data->>'harassment_occurrence' != ''`);
	
	const harassmentByGender = await db
		.select({
			gender: sql<string>`data->>'gender'`,
			harassment: sql<number>`count(*) filter (where data->>'harassment_occurrence' != '')`,
			total: sql<number>`count(*)`
		})
		.from(cyclistProfiles)
		.where(yearFilter)
		.groupBy(sql`data->>'gender'`);
	
	const total = totalResult.count;
	
	return c.json({
		year: year || "all",
		total_responses: total,
		accidents: {
			percentage_with_accidents: Number(((accidentsResult.count / total) * 100).toFixed(1)),
			by_gender: Object.fromEntries(
				accidentsByGender
					.filter(a => a.gender)
					.map(a => [a.gender, Number(((a.accidents / a.total) * 100).toFixed(1))])
			)
		},
		theft: {
			percentage_theft: Number(((theftResult.count / total) * 100).toFixed(1))
		},
		harassment: {
			percentage_harassment: Number(((harassmentResult.count / total) * 100).toFixed(1)),
			by_gender: Object.fromEntries(
				harassmentByGender
					.filter(h => h.gender)
					.map(h => [h.gender, Number(((h.harassment / h.total) * 100).toFixed(1))])
			)
		}
	}, HttpStatusCodes.OK);
};

export const surveyLocations: RouteHandler<SurveyLocationsRoute, AppBindings> = async (c) => {
	try {
		const year = c.req.query("year") ? Number(c.req.query("year")) : undefined;
		const gender = c.req.query("gender");
		const race = c.req.query("race");
		const income = c.req.query("income");
	
	// Build filters
	let filters = [sql`coordinates IS NOT NULL`];
	
	if (year) {
		filters.push(sql`metadata->>'survey_year' = ${year.toString()}`);
	}
	if (gender) {
		filters.push(sql`data->>'gender' = ${gender}`);
	}
	if (race) {
		filters.push(sql`data->>'color_race' = ${race}`);
	}
	if (income) {
		filters.push(sql`data->>'age_standard' = ${income}`);
	}
	
	const whereClause = filters.length > 1 
		? sql.join(filters, sql` AND `)
		: filters[0];
	
	// Get aggregated data by location
	const locationData = await db
		.select({
			lat: sql<number>`ST_Y(coordinates)`,
			lon: sql<number>`ST_X(coordinates)`,
			neighborhood: sql<string>`metadata->>'neighborhood'`,
			street: sql<string>`metadata->>'street'`,
			area: sql<string>`metadata->>'area'`,
			survey_year: sql<string>`metadata->>'survey_year'`,
			count: sql<number>`count(*)`,
			avg_age: sql<number>`avg((data->>'age')::numeric)`,
			avg_days_usage: sql<number>`avg((data->'days_usage'->>'total')::numeric)`,
			avg_distance_time: sql<number>`avg((data->>'distance_time')::numeric)`,
			male_percentage: sql<number>`(count(*) filter (where data->>'gender' = 'Masculino')::float / count(*) * 100)`,
			female_percentage: sql<number>`(count(*) filter (where data->>'gender' = 'Feminino')::float / count(*) * 100)`,
			private_bike_percentage: sql<number>`(count(*) filter (where metadata->>'bike_type' = 'Privada')::float / count(*) * 100)`,
			accidents_percentage: sql<number>`(count(*) filter (where data->>'collisions' = 'Sim')::float / count(*) * 100)`,
			top_motivation: sql<string>`mode() within group (order by data->>'motivation_to_continue')`,
			top_issue: sql<string>`mode() within group (order by data->>'biggest_issue')`
		})
		.from(cyclistProfiles)
		.where(whereClause)
		.groupBy(
			sql`ST_Y(coordinates)`,
			sql`ST_X(coordinates)`,
			sql`metadata->>'neighborhood'`,
			sql`metadata->>'street'`,
			sql`metadata->>'area'`,
			sql`metadata->>'survey_year'`
		)
		.having(sql`count(*) >= 3`) // Only locations with 3+ responses
		.orderBy(sql`count(*) desc`);
	
	return c.json({
		filters: { year, gender, race, income },
		total_locations: locationData.length,
		locations: locationData.map(loc => ({
			coordinates: {
				lat: loc.lat ? Number(Number(loc.lat).toFixed(6)) : 0,
				lon: loc.lon ? Number(Number(loc.lon).toFixed(6)) : 0
			},
			location_info: {
				neighborhood: loc.neighborhood || 'N/A',
				street: loc.street || 'N/A',
				area: loc.area || 'N/A',
				survey_year: loc.survey_year
			},
			statistics: {
				total_responses: loc.count,
				avg_age: loc.avg_age ? Number(Number(loc.avg_age).toFixed(1)) : 0,
				avg_days_per_week: loc.avg_days_usage ? Number(Number(loc.avg_days_usage).toFixed(1)) : 0,
				avg_trip_time_minutes: loc.avg_distance_time ? Number(Number(loc.avg_distance_time).toFixed(1)) : 0,
				gender_distribution: {
					male_percentage: loc.male_percentage ? Number(Number(loc.male_percentage).toFixed(1)) : 0,
					female_percentage: loc.female_percentage ? Number(Number(loc.female_percentage).toFixed(1)) : 0
				},
				private_bike_percentage: loc.private_bike_percentage ? Number(Number(loc.private_bike_percentage).toFixed(1)) : 0,
				accidents_percentage: loc.accidents_percentage ? Number(Number(loc.accidents_percentage).toFixed(1)) : 0,
				top_motivation: loc.top_motivation || 'N/A',
				top_issue: loc.top_issue || 'N/A'
			}
		}))
	}, HttpStatusCodes.OK);
	} catch (error) {
		console.error('Survey locations error:', error);
		return c.json({ error: error.message }, 500);
	}
};