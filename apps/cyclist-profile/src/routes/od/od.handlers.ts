import type { AppRouteHandler } from "../../lib/types.js";
import { db } from "../../db/index.js";
import type { FlowsRoute, MatrixRoute } from "./od.routes.js";

function esc(v: string): string {
	return `'${v.replace(/'/g, "''")}'`;
}

function buildODWhere(filters: Record<string, unknown>): string {
	const conditions: string[] = [
		"data->>'neighborhood_origin' is not null",
		"data->>'neighborhood_origin' != ''",
		"data->>'neighborhood_destiny' is not null",
		"data->>'neighborhood_destiny' != ''",
	];

	const addIn = (source: string, vals: unknown) => {
		if (Array.isArray(vals) && vals.length > 0) {
			conditions.push(`${source} in (${vals.map((v) => esc(String(v))).join(", ")})`);
		}
	};

	addIn("metadata->>'survey_year'", filters.year);
	addIn("data->>'gender'", filters.gender);
	addIn("data->>'age_standard'", filters.income_range);
	addIn("data->>'color_race'", filters.race_color);

	return conditions.join(" and ");
}

export const matrix: AppRouteHandler<MatrixRoute> = async (c) => {
	const body = c.req.valid("json");
	const filters = (body.filters || {}) as Record<string, unknown>;
	const metric = body.metric || "interviews_count";
	const minCount = body.min_count || 3;
	const limit = body.limit || 50;

	const whereStr = buildODWhere(filters);

	const metricExpr =
		metric === "distance_time_median"
			? "round(percentile_cont(0.5) within group (order by (data->>'distance_time')::numeric)::numeric, 1)"
			: "count(*)";

	const query = `
		select
			data->>'neighborhood_origin' as origin,
			data->>'neighborhood_destiny' as destination,
			count(*) as interviews_count,
			${metricExpr} as metric_value
		from cyclist_profiles
		where ${whereStr}
		group by data->>'neighborhood_origin', data->>'neighborhood_destiny'
		having count(*) >= ${minCount}
		order by count(*) desc
		limit ${limit}
	`;

	const result = await db.execute(query);
	const rows = (result as { rows: Record<string, unknown>[] }).rows || [];

	return c.json({
		data: rows.map((r) => ({
			origin: String(r.origin || ""),
			destination: String(r.destination || ""),
			interviews_count: Number(r.interviews_count || 0),
			[metric]: Number(r.metric_value || 0),
		})),
	});
};

export const flows: AppRouteHandler<FlowsRoute> = async (c) => {
	const body = c.req.valid("json");
	const filters = (body.filters || {}) as Record<string, unknown>;
	const minCount = body.min_count || 3;
	const limit = body.limit || 50;

	const whereStr = buildODWhere(filters);

	const query = `
		select
			data->>'neighborhood_origin' as origin,
			data->>'neighborhood_destiny' as destination,
			count(*) as interviews_count,
			round(avg((data->>'distance_time')::numeric), 1) as distance_time_avg,
			avg(ST_Y(coordinates)) filter (where metadata->>'neighborhood' = (data->>'neighborhood_origin')) as origin_lat,
			avg(ST_X(coordinates)) filter (where metadata->>'neighborhood' = (data->>'neighborhood_origin')) as origin_lon,
			avg(ST_Y(coordinates)) filter (where metadata->>'neighborhood' = (data->>'neighborhood_destiny')) as dest_lat,
			avg(ST_X(coordinates)) filter (where metadata->>'neighborhood' = (data->>'neighborhood_destiny')) as dest_lon
		from cyclist_profiles
		where ${whereStr} and coordinates is not null
		group by data->>'neighborhood_origin', data->>'neighborhood_destiny'
		having count(*) >= ${minCount}
		order by count(*) desc
		limit ${limit}
	`;

	const result = await db.execute(query);
	const rows = (result as { rows: Record<string, unknown>[] }).rows || [];

	return c.json({
		type: "FeatureCollection",
		features: rows
			.filter((r) => r.origin_lon && r.origin_lat && r.dest_lon && r.dest_lat)
			.map((r) => ({
				type: "Feature",
				geometry: {
					type: "LineString",
					coordinates: [
						[Number(r.origin_lon), Number(r.origin_lat)],
						[Number(r.dest_lon), Number(r.dest_lat)],
					],
				},
				properties: {
					origin: String(r.origin || ""),
					destination: String(r.destination || ""),
					interviews_count: Number(r.interviews_count || 0),
					distance_time_avg: Number(r.distance_time_avg || 0),
				},
			})),
	});
};
