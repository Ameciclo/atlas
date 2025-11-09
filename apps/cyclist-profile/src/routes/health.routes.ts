import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const tags = ["System"];

export const health = createRoute({
	path: "/health",
	method: "get",
	tags,
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				status: z.string(),
				service: z.string(),
			}),
			"Health check response",
		),
	},
});

export type HealthRoute = typeof health;
