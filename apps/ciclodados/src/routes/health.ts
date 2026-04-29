import { createRoute, z } from "@hono/zod-openapi";
import { createRouter } from "../lib/create-app.js";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import {
	checkDatabaseConnection,
	checkPcrStreetsTable,
} from "../lib/health-check.js";

const healthSchema = z.object({
	status: z.enum(["ok", "error"]),
	timestamp: z.string(),
	service: z.string(),
	database: z.boolean(),
	pcr_streets: z.boolean(),
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
	const db = c.get("db");
	const dbConnected = await checkDatabaseConnection(db);
	const pcrStreetsOk = await checkPcrStreetsTable(db);
	const isHealthy = dbConnected && pcrStreetsOk;

	return c.json(
		{
			status: isHealthy ? ("ok" as const) : ("error" as const),
			timestamp: new Date().toISOString(),
			service: "ciclodados",
			database: dbConnected,
			pcr_streets: pcrStreetsOk,
		},
		isHealthy ? HttpStatusCodes.OK : HttpStatusCodes.SERVICE_UNAVAILABLE,
	);
});

export default router;
