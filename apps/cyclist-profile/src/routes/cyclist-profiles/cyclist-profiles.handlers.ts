import type { RouteHandler } from "@hono/zod-openapi";
import { eq, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";
import { cyclistProfiles } from "@atlas/database/schemas/cyclist-profile";
import type { AppBindings } from "../../lib/types.ts";
import type {
	GetOneRoute,
	ListRoute,
	NearbyRoute,
	NearbySummaryRoute,
} from "./cyclist-profiles.routes.ts";

export const list: RouteHandler<ListRoute, AppBindings> = async (c) => {
	const db = c.get("db");
	const profiles = await db.select().from(cyclistProfiles);
	return c.json(profiles);
};

export const getOne: RouteHandler<GetOneRoute, AppBindings> = async (c) => {
	const db = c.get("db");
	const { id } = c.req.valid("param");
	const profile = await db
		.select()
		.from(cyclistProfiles)
		.where(eq(cyclistProfiles.id, id))
		.limit(1);

	if (profile.length === 0) {
		return c.json(
			{
				message: HttpStatusPhrases.NOT_FOUND,
			},
			HttpStatusCodes.NOT_FOUND,
		);
	}

	return c.json(profile[0], HttpStatusCodes.OK);
};

export const nearby: RouteHandler<NearbyRoute, AppBindings> = async (c) => {
	const db = c.get("db");
	const { lat, lon, radius, limit } = c.req.valid("query");

	const profiles = await db
		.select()
		.from(cyclistProfiles)
		.where(
			sql`ST_DWithin(coordinates, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326), ${radius})`,
		)
		.orderBy(
			sql`ST_Distance(coordinates, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326))`,
		)
		.limit(limit);

	return c.json(profiles, HttpStatusCodes.OK);
};

export const nearbySummary: RouteHandler<
	NearbySummaryRoute,
	AppBindings
> = async (c) => {
	const db = c.get("db");
	const { lat, lon, radius, limit } = c.req.valid("query");

	const profiles = await db
		.select({
			id: cyclistProfiles.id,
			gender: sql<string>`data->>'gender'`,
			age: sql<number>`(data->>'age')::numeric`,
			days_usage: sql<number>`(data->'days_usage'->>'total')::numeric`,
			bike_type: sql<string>`metadata->>'bike_type'`,
			neighborhood: sql<string>`metadata->>'neighborhood'`,
			survey_year: sql<string>`metadata->>'survey_year'`,
			distance: sql<number>`ST_Distance(coordinates, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326))`,
		})
		.from(cyclistProfiles)
		.where(
			sql`coordinates IS NOT NULL AND ST_DWithin(coordinates, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326), ${radius})`,
		)
		.orderBy(
			sql`ST_Distance(coordinates, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326))`,
		)
		.limit(limit);

	return c.json(
		{
			total: profiles.length,
			profiles: profiles.map((p) => ({
				id: p.id,
				gender: p.gender,
				age: p.age,
				days_per_week: p.days_usage,
				bike_type: p.bike_type,
				neighborhood: p.neighborhood,
				survey_year: p.survey_year,
				distance_meters: Math.round(p.distance || 0),
			})),
		},
		HttpStatusCodes.OK,
	);
};
