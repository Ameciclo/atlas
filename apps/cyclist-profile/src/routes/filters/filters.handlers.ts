import { sql } from "drizzle-orm";
import type { AppRouteHandler } from "../../lib/types.js";
import { db } from "../../db/index.js";
import { cyclistProfiles } from "@atlas/database/schemas/cyclist-profile";
import type { ListRoute } from "./filters.routes.js";

async function distinctValues(field: string, limit = 30) {
	const rows = await db
		.select({
			value: sql<string>`${sql.raw(field)}`,
			count: sql<number>`count(*)`,
		})
		.from(cyclistProfiles)
		.where(
			sql`${sql.raw(field)} IS NOT NULL AND ${sql.raw(field)} != ''`,
		)
		.groupBy(sql`${sql.raw(field)}`)
		.orderBy(sql`count(*) desc`)
		.limit(limit);

	return rows
		.filter((r) => r.value)
		.map((r) => ({ code: r.value, label: r.value }));
}

export const list: AppRouteHandler<ListRoute> = async (c) => {
	const [yearsResult, totalResult] = await Promise.all([
		db
			.select({
				year: sql<number>`(metadata->>'survey_year')::int`,
			})
			.from(cyclistProfiles)
			.where(sql`metadata->>'survey_year' IS NOT NULL`)
			.groupBy(sql`metadata->>'survey_year'`)
			.orderBy(sql`metadata->>'survey_year'`),
		db
			.select({ count: sql<number>`count(*)` })
			.from(cyclistProfiles),
	]);

	const years = yearsResult
		.map((r) => r.year)
		.filter((y): y is number => y !== null && y > 2000 && y < 2100)
		.sort((a, b) => a - b);

	const [
		areas,
		genders,
		raceColors,
		ageCategories,
		schoolingLevels,
		incomeRanges,
		bikeTypes,
		yearsUsing,
		issues,
		needs,
		motivationsStart,
		motivationsContinue,
		transportModes,
		weekdays,
		countPoints,
	] = await Promise.all([
		distinctValues("metadata->>'area'"),
		distinctValues("data->>'gender'"),
		distinctValues("data->>'color_race'"),
		distinctValues("data->>'age_category'"),
		distinctValues("data->>'schooling'"),
		distinctValues("data->>'age_standard'"),
		distinctValues("metadata->>'bike_type'"),
		distinctValues("data->>'years_using'"),
		distinctValues("data->>'biggest_issue'"),
		distinctValues("data->>'biggest_need'"),
		distinctValues("data->>'motivation_to_start'"),
		distinctValues("data->>'motivation_to_continue'"),
		distinctValues("data->>'transportation_combined'"),
		distinctValues("metadata->>'weekday'"),
		db
			.select({
				code: sql<string>`metadata->>'neighborhood'`,
				label: sql<string>`metadata->>'neighborhood'`,
				lat: sql<number>`AVG(ST_Y(coordinates))`,
				lon: sql<number>`AVG(ST_X(coordinates))`,
				count: sql<number>`count(*)`,
			})
			.from(cyclistProfiles)
			.where(sql`coordinates IS NOT NULL AND metadata->>'neighborhood' IS NOT NULL AND metadata->>'neighborhood' != ''`)
			.groupBy(sql`metadata->>'neighborhood'`)
			.orderBy(sql`count(*) desc`),
	]);

	return c.json({
		data: {
			years,
			areas,
			genders,
			race_colors: raceColors,
			age_categories: ageCategories,
			schooling_levels: schoolingLevels,
			income_ranges: incomeRanges,
			bike_types: bikeTypes,
			years_using_options: yearsUsing,
			issues,
			needs,
			motivations_start: motivationsStart,
			motivations_continue: motivationsContinue,
			transport_modes: transportModes,
			weekdays,
			count_points: countPoints.map((p) => ({
				...p,
				years,
				lat: p.lat ? Number(p.lat) : null,
				lon: p.lon ? Number(p.lon) : null,
			})),
			total_interviews: Number(totalResult[0]?.count || 0),
		},
	});
};
