import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { db } from "../db/index.js";
import { createRouter } from "../lib/create-app.js";

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
	} catch (_error) {
		dbStatus = "disconnected";
		return c.json(
			{
				status: "error" as const,
				timestamp: new Date().toISOString(),
				service: "cyclist-profile",
				database: dbStatus,
			},
			HttpStatusCodes.SERVICE_UNAVAILABLE,
		);
	}

	return c.json({
		status: "ok" as const,
		timestamp: new Date().toISOString(),
		service: "cyclist-profile",
		database: dbStatus,
	});
});

export default router;

