import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const tags = ["Distribution"];

const variables = ["age", "distance_time", "days_total"] as const;

const requestSchema = z.object({
	filters: z
		.object({
			year: z.array(z.number()).optional(),
			gender: z.array(z.string()).optional(),
		})
		.optional()
		.default({}),
	variable: z.enum(variables),
	group_by: z.string().optional(),
	bin_size: z.number().optional(),
	bins: z.number().optional().default(10),
});

export const query = createRoute({
	path: "/distribution",
	method: "post",
	request: { body: jsonContent(requestSchema, "Distribution query") },
	tags,
	responses: {
		[HttpStatusCodes.OK]: jsonContent(z.unknown(), "Distribution data"),
	},
});

export type QueryRoute = typeof query;
