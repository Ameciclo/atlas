import { createRouter } from "../../lib/create-app.js";
import { sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { cyclistProfiles } from "@atlas/database/schemas/cyclist-profile";

import * as handlers from "./cyclist-profiles.handlers.js";
import * as routes from "./cyclist-profiles.routes.js";

const router = createRouter()
	.openapi(routes.list, handlers.list)
	.openapi(routes.getOne, handlers.getOne)
	.openapi(routes.nearby, handlers.nearby)
	.openapi(routes.nearbySummary, handlers.nearbySummary)
	// Simple route without Zod validation
	.get("/nearby-simple", async (c) => {
		const lat = Number(c.req.query("lat") || -8.05);
		const lon = Number(c.req.query("lon") || -34.88);
		const radius = Number(c.req.query("radius") || 1000);
		const limit = Number(c.req.query("limit") || 50);
		
		// Select only safe columns, exclude coordinates
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
	});

export default router;
