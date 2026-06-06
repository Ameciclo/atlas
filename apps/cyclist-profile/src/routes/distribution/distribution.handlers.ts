import type { AppRouteHandler } from "../../lib/types.js";
import { db } from "../../db/index.js";
import type { QueryRoute } from "./distribution.routes.js";

function esc(v: string): string {
	return `'${v.replace(/'/g, "''")}'`;
}

export const query: AppRouteHandler<QueryRoute> = async (c) => {
	const body = c.req.valid("json");
	const filters = body.filters || {};
	const variable = body.variable;
	const groupBy = body.group_by;
	const bins = body.bins || 10;

	const varSources: Record<string, string> = {
		age: "(data->>'age')::int",
		distance_time: "(data->>'distance_time')::int",
		days_total: "(data->'days_usage'->>'total')::int",
	};

	const source = varSources[variable];

	const conditions: string[] = [`${source} is not null`, `${source} > 0`];

	const addIn = (f: string, vals: unknown) => {
		if (Array.isArray(vals) && vals.length > 0) {
			conditions.push(`${f} in (${vals.map((v) => esc(String(v))).join(", ")})`);
		}
	};

	addIn("metadata->>'survey_year'", filters.year);
	addIn("data->>'gender'", filters.gender);

	const whereStr = conditions.join(" and ");

	const selectParts = [`width_bucket(${source}, 1, 100, ${bins}) as bin_idx`, "count(*) as count"];

	if (groupBy === "gender") {
		selectParts.push("data->>'gender' as gender");
	}

	const groupParts = ["bin_idx"];
	if (groupBy === "gender") {
		groupParts.push("data->>'gender'");
	}

	const query = `
		select ${selectParts.join(", ")}
		from cyclist_profiles
		where ${whereStr}
		group by ${groupParts.join(", ")}
		order by bin_idx
	`;

	const result = await db.execute(query);
	const rows = (result as { rows: Record<string, unknown>[] }).rows || [];

	// Statistics
	const statsParts = ["count(*)", `round(avg(${source}), 1) as avg`, `min(${source}) as min`, `round(percentile_cont(0.25) within group (order by ${source})::numeric, 1) as p25`, `round(percentile_cont(0.5) within group (order by ${source})::numeric, 1) as median`, `round(percentile_cont(0.75) within group (order by ${source})::numeric, 1) as p75`, `max(${source}) as max`];

	if (groupBy === "gender") {
		statsParts.push("data->>'gender' as gender");
	}

	const statsGroupParts = groupBy === "gender" ? ["data->>'gender'"] : [];

	const statsQuery = `
		select ${statsParts.join(", ")}
		from cyclist_profiles
		where ${whereStr}
		${statsGroupParts.length > 0 ? `group by ${statsGroupParts.join(", ")}` : ""}
	`;

	const statsResult = await db.execute(statsQuery);
	const statsRows = (statsResult as { rows: Record<string, unknown>[] }).rows || [];

	return c.json({
		data: {
			bins: rows.map((r) => ({
				bin_idx: Number(r.bin_idx || 0),
				count: Number(r.count || 0),
				...(groupBy === "gender" ? { gender: String(r.gender || "") } : {}),
			})),
			statistics: statsRows.map((r) => ({
				min: Number(r.min || 0),
				p25: Number(r.p25 || 0),
				median: Number(r.median || 0),
				p75: Number(r.p75 || 0),
				max: Number(r.max || 0),
				avg: Number(r.avg || 0),
				count: Number(r.count || 0),
				...(groupBy === "gender" ? { gender: String(r.gender || "") } : {}),
			})),
		},
		variable,
	});
};
