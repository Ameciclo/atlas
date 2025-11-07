import { Hono } from "hono";
import { cors } from "hono/cors";
import { OpenAPIHono } from "@hono/zod-openapi";
import { sql } from "drizzle-orm";
import { db } from "./db/index.js";
import { cyclistProfiles } from "@atlas/database/schemas/cyclist-profile";
import cyclistProfilesRoutes from "./routes/cyclist-profiles/cyclist-profiles.index.js";
import healthRoutes from "./routes/health.js";

import * as analyticsHandlers from "./routes/cyclist-profiles/analytics.handlers.js";

// Completely clean Hono app without any hooks
const cleanApp = new Hono()
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
	// Analytics endpoints
	.get("/v1/cyclist-profiles/summary", analyticsHandlers.summary)
	.get("/v1/cyclist-profiles/trends", analyticsHandlers.trends)
	.get("/v1/cyclist-profiles/gender-analysis", analyticsHandlers.genderAnalysis)
	.get("/v1/cyclist-profiles/safety-analysis", analyticsHandlers.safetyAnalysis)
	.get("/v1/cyclist-profiles/survey-locations", analyticsHandlers.surveyLocations);

// OpenAPI app (with validation issues)
const openApiApp = new OpenAPIHono({
	strict: false,
	// NO defaultHook!
})
	.use(cors())
	.route("/", healthRoutes)
	.route("/v1/", cyclistProfilesRoutes);

// Combine both apps
const app = cleanApp.route("/openapi", openApiApp);

export default app;
