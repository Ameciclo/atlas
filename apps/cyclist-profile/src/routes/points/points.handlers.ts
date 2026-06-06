import { sql } from "drizzle-orm";
import type { AppRouteHandler } from "../../lib/types.js";
import { db } from "../../db/index.js";
import { cyclistProfiles } from "@atlas/database/schemas/cyclist-profile";
import type { GeoJsonRoute, ListRoute } from "./points.routes.js";

interface Filters {
	year?: number;
	area?: string;
	gender?: string;
	race?: string;
	income?: string;
}

function buildFilters(f: Filters): ReturnType<typeof sql>[] {
	const filters: ReturnType<typeof sql>[] = [sql`coordinates IS NOT NULL`];
	if (f.year) filters.push(sql`metadata->>'survey_year' = ${f.year.toString()}`);
	if (f.area) filters.push(sql`metadata->>'area' = ${f.area}`);
	if (f.gender) filters.push(sql`data->>'gender' = ${f.gender}`);
	if (f.race) filters.push(sql`data->>'color_race' = ${f.race}`);
	if (f.income) filters.push(sql`data->>'age_standard' = ${f.income}`);
	return filters;
}

export const list: AppRouteHandler<ListRoute> = async (c) => {
	const query = c.req.valid("query");
	const { min_interviews, ...filterFields } = query;
	const filters = buildFilters(filterFields);
	const whereClause = sql.join(filters, sql` AND `);

	const rows = await db
		.select({
			lat: sql<number>`ST_Y(coordinates)`,
			lon: sql<number>`ST_X(coordinates)`,
			neighborhood: sql<string>`metadata->>'neighborhood'`,
			area: sql<string>`metadata->>'area'`,
			year: sql<string>`metadata->>'survey_year'`,
			count: sql<number>`count(*)`,
			women_pct: sql<number>`round(count(*) filter (where data->>'gender' = 'Feminino')::numeric / nullif(count(*), 0) * 100, 1)`,
			collision_pct: sql<number>`round(count(*) filter (where data->>'collisions' = 'Sim')::numeric / nullif(count(*), 0) * 100, 1)`,
			low_income_pct: sql<number>`round(count(*) filter (where data->>'age_standard' in ('Ate 1 salario minimo','De 1 a 2 salarios minimos'))::numeric / nullif(count(*), 0) * 100, 1)`,
			avg_distance: sql<number>`round(avg((data->>'distance_time')::numeric), 1)`,
		})
		.from(cyclistProfiles)
		.where(whereClause)
		.groupBy(sql`ST_Y(coordinates)`, sql`ST_X(coordinates)`, sql`metadata->>'neighborhood'`, sql`metadata->>'area'`, sql`metadata->>'survey_year'`)
		.having(sql`count(*) >= ${min_interviews}`)
		.orderBy(sql`count(*) desc`);

	return c.json({
		data: rows.map((r) => ({
			code: `${r.neighborhood || "unknown"}_${r.year}`,
			label: r.neighborhood || "N/A",
			area: r.area || "N/A",
			neighborhood: r.neighborhood || "N/A",
			lat: r.lat ? Number(r.lat) : null,
			lon: r.lon ? Number(r.lon) : null,
			year: r.year,
			interviews_count: Number(r.count),
			women_percent: Number(r.women_pct || 0),
			collision_report_percent: Number(r.collision_pct || 0),
			low_income_percent: Number(r.low_income_pct || 0),
			distance_time_avg: Number(r.avg_distance || 0),
		})),
	});
};

export const geojson: AppRouteHandler<GeoJsonRoute> = async (c) => {
	const query = c.req.valid("query");
	const { min_interviews, ...filterFields } = query;
	const filters = buildFilters(filterFields);
	const whereClause = sql.join(filters, sql` AND `);

	const rows = await db
		.select({
			lat: sql<number>`ST_Y(coordinates)`,
			lon: sql<number>`ST_X(coordinates)`,
			neighborhood: sql<string>`metadata->>'neighborhood'`,
			area: sql<string>`metadata->>'area'`,
			count: sql<number>`count(*)`,
			women_pct: sql<number>`round(count(*) filter (where data->>'gender' = 'Feminino')::numeric / nullif(count(*), 0) * 100, 1)`,
			collision_pct: sql<number>`round(count(*) filter (where data->>'collisions' = 'Sim')::numeric / nullif(count(*), 0) * 100, 1)`,
			low_income_pct: sql<number>`round(count(*) filter (where data->>'age_standard' in ('Ate 1 salario minimo','De 1 a 2 salarios minimos'))::numeric / nullif(count(*), 0) * 100, 1)`,
		})
		.from(cyclistProfiles)
		.where(whereClause)
		.groupBy(sql`ST_Y(coordinates)`, sql`ST_X(coordinates)`, sql`metadata->>'neighborhood'`, sql`metadata->>'area'`)
		.having(sql`count(*) >= ${min_interviews}`)
		.orderBy(sql`count(*) desc`);

	return c.json({
		type: "FeatureCollection",
		features: rows.map((r) => ({
			type: "Feature",
			geometry: {
				type: "Point",
				coordinates: [r.lon ? Number(r.lon) : 0, r.lat ? Number(r.lat) : 0],
			},
			properties: {
				neighborhood: r.neighborhood || "N/A",
				area: r.area || "N/A",
				interviews_count: Number(r.count),
				women_percent: Number(r.women_pct || 0),
				collision_report_percent: Number(r.collision_pct || 0),
				low_income_percent: Number(r.low_income_pct || 0),
			},
		})),
	});
};
