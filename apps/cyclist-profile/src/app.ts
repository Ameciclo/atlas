import { Hono } from "hono";
import { cors } from "hono/cors";
import { OpenAPIHono } from "@hono/zod-openapi";
import { sql } from "drizzle-orm";
import { db } from "./db/index.js";
import { cyclistProfiles } from "@atlas/database/schemas/cyclist-profile";
import cyclistProfilesRoutes from "./routes/cyclist-profiles/cyclist-profiles.index.js";
import analyticsRoutes from "./routes/cyclist-profiles/analytics.index.js";
import healthRoutes from "./routes/health.index.js";

import * as analyticsHandlers from "./routes/cyclist-profiles/analytics.handlers.js";

// Completely clean Hono app without any hooks
const cleanApp = new Hono()
	.get("/health", (c) => c.json({ status: "ok", service: "cyclist-profile" }))
	.get("/test", (c) => c.text("Clean app works!"))
	.get("/v1/cyclist-profiles/debug", async (c) => {
		try {
			const result = await db
				.select({ id: cyclistProfiles.id })
				.from(cyclistProfiles)
				.limit(3);
			
			const ids = result.map(r => `ID: ${r.id} (type: ${typeof r.id})`);
			return c.text(ids.join('\n'));
		} catch (error) {
			return c.text(`Error: ${error}`);
		}
	})
	.get("/v1/cyclist-profiles/nearby", async (c) => {
		const lat = Number(c.req.query("lat") || -8.05);
		const lon = Number(c.req.query("lon") || -34.88);
		const radius = Number(c.req.query("radius") || 1000);
		const limit = Number(c.req.query("limit") || 50);
		
		const profiles = await db
			.select({
				id: cyclistProfiles.id,
				data: cyclistProfiles.data,
				metadata: cyclistProfiles.metadata,
				created_at: cyclistProfiles.created_at,
				updated_at: cyclistProfiles.updated_at
			})
			.from(cyclistProfiles)
			.where(
				sql`coordinates IS NOT NULL AND ST_DWithin(coordinates, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326), ${radius})`
			)
			.orderBy(
				sql`ST_Distance(coordinates, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326))`
			)
			.limit(limit);
		
		return c.json(profiles);
	})
	.get("/v1/cyclist-profiles/nearby-summary", async (c) => {
		const lat = Number(c.req.query("lat") || -8.05);
		const lon = Number(c.req.query("lon") || -34.88);
		const radius = Number(c.req.query("radius") || 1000);
		const limit = Number(c.req.query("limit") || 50);
		
		const profiles = await db
			.select({
				id: cyclistProfiles.id,
				gender: sql<string>`data->>'gender'`,
				age: sql<number>`(data->>'age')::numeric`,
				days_usage: sql<number>`(data->'days_usage'->>'total')::numeric`,
				bike_type: sql<string>`metadata->>'bike_type'`,
				neighborhood: sql<string>`metadata->>'neighborhood'`,
				survey_year: sql<string>`metadata->>'survey_year'`,
				distance: sql<number>`ST_Distance(coordinates, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326))`
			})
			.from(cyclistProfiles)
			.where(
				sql`coordinates IS NOT NULL AND ST_DWithin(coordinates, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326), ${radius})`
			)
			.orderBy(
				sql`ST_Distance(coordinates, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326))`
			)
			.limit(limit);
		
		return c.json({
			total: profiles.length,
			profiles: profiles.map(p => ({
				id: p.id,
				gender: p.gender,
				age: p.age,
				days_per_week: p.days_usage,
				bike_type: p.bike_type,
				neighborhood: p.neighborhood,
				survey_year: p.survey_year,
				distance_meters: Math.round(p.distance)
			}))
		});
	})
	// Analytics endpoints
	.get("/v1/cyclist-profiles/summary", analyticsHandlers.summary)
	.get("/v1/cyclist-profiles/trends", analyticsHandlers.trends)
	.get("/v1/cyclist-profiles/gender-analysis", analyticsHandlers.genderAnalysis)
	.get("/v1/cyclist-profiles", async (c) => {
		const profiles = await db.select().from(cyclistProfiles);
		return c.json(profiles);
	})
	.get("/v1/cyclist-profiles/safety-analysis", analyticsHandlers.safetyAnalysis)
	.get("/v1/cyclist-profiles/survey-locations", analyticsHandlers.surveyLocations);

// OpenAPI app (with validation issues)
const openApiApp = new OpenAPIHono({
	strict: false,
	// NO defaultHook!
})
	.use(cors())
	.route("/", healthRoutes)
	.route("/v1/", cyclistProfilesRoutes)
	.route("/v1/", analyticsRoutes);

// Combine both apps
const app = cleanApp.route("/openapi", openApiApp);

export default app;
