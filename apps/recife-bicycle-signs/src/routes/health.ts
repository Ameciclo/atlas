import { createRoute, z } from "@hono/zod-openapi";
import { createRouter } from "../lib/create-app.js";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { db } from "../db/index.js";

const healthSchema = z.object({
	status: z.enum(["ok", "error"]),
	timestamp: z.string(),
	service: z.string(),
	database: z.enum(["connected", "disconnected"]),
});

const healthRoute = createRoute({
	path: "/health",
	method: "get",
	tags: ["System"],
	responses: {
		[HttpStatusCodes.OK]: jsonContent(healthSchema, "Service is healthy"),
		[HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
			healthSchema,
			"Service is unhealthy",
		),
	},
});

const router = createRouter();

router.openapi(healthRoute, async (c) => {
	let dbStatus: "connected" | "disconnected" = "connected";
	
	try {
		// Simple database check
		await db.execute("SELECT 1");
	} catch (error) {
		dbStatus = "disconnected";
		return c.json(
			{
				status: "error" as const,
				timestamp: new Date().toISOString(),
				service: "recife-bicycle-signs",
				database: dbStatus,
			},
			HttpStatusCodes.SERVICE_UNAVAILABLE,
		);
	}

	return c.json({
		status: "ok" as const,
		timestamp: new Date().toISOString(),
		service: "recife-bicycle-signs",
		database: dbStatus,
	});
});

export default router;
