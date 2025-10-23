import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const tags = ["Summary"];

// GET /v1/summary
// Returns overall statistics for traffic deaths
export const getSummary = createRoute({
	path: "/summary",
	method: "get",
	tags,
	request: {
		query: z.object({
			year: z.coerce.number().int().min(2015).max(2030).optional(),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				total_deaths: z.number(),
				year: z.number().nullable(),
				message: z.string(),
			}),
			"Traffic deaths summary statistics",
		),
	},
});

