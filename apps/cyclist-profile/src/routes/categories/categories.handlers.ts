import { sql } from "drizzle-orm";
import type { AppRouteHandler } from "../../lib/types.js";
import { db } from "../../db/index.js";
import { cyclistProfiles } from "@atlas/database/schemas/cyclist-profile";
import type { ListRoute } from "./categories.routes.js";

const fieldSources: Record<string, { source: string; isMetadata: boolean }> = {
	gender: { source: "data->>'gender'", isMetadata: false },
	color_race: { source: "data->>'color_race'", isMetadata: false },
	age_category: { source: "data->>'age_category'", isMetadata: false },
	schooling: { source: "data->>'schooling'", isMetadata: false },
	income_range: { source: "data->>'age_standard'", isMetadata: false },
	bike_type: { source: "metadata->>'bike_type'", isMetadata: true },
	years_using: { source: "data->>'years_using'", isMetadata: false },
	collided: { source: "data->>'collisions'", isMetadata: false },
	biggest_issue: { source: "data->>'biggest_issue'", isMetadata: false },
	biggest_need: { source: "data->>'biggest_need'", isMetadata: false },
	motivation_to_start: {
		source: "data->>'motivation_to_start'",
		isMetadata: false,
	},
	motivation_to_continue: {
		source: "data->>'motivation_to_continue'",
		isMetadata: false,
	},
	transport_mode: {
		source: "data->>'transportation_combined'",
		isMetadata: false,
	},
	weekday: { source: "metadata->>'weekday'", isMetadata: true },
	area: { source: "metadata->>'area'", isMetadata: true },
	survey_year: { source: "metadata->>'survey_year'", isMetadata: true },
};

export const list: AppRouteHandler<ListRoute> = async (c) => {
	const { group } = c.req.valid("query");

	const keys = group ? [group] : Object.keys(fieldSources);
	const result: Record<
		string,
		Array<{ code: string; label: string; count: number }>
	> = {};

	for (const key of keys) {
		const field = fieldSources[key];
		if (!field) continue;

		const rows = await db
			.select({
				value: sql<string>`${sql.raw(field.source)}`,
				count: sql<number>`count(*)`,
			})
			.from(cyclistProfiles)
			.where(
				sql`${sql.raw(field.source)} IS NOT NULL AND ${sql.raw(field.source)} != ''`,
			)
			.groupBy(sql`${sql.raw(field.source)}`)
			.orderBy(sql`count(*) desc`)
			.limit(50);

		result[key] = rows
			.filter((r) => r.value)
			.map((r) => ({
				code: r.value,
				label: r.value,
				count: Number(r.count),
			}));
	}

	if (group && result[group]) {
		return c.json({ data: result[group] });
	}

	return c.json({ data: Object.values(result).flat() });
};
