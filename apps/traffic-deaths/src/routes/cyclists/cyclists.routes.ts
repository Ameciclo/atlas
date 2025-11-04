import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const tags = ["Cyclists"];

// GET /v1/deaths/cyclists
// Returns cyclist deaths statistics (CID-10 codes V10-V19)
export const getCyclistDeaths = createRoute({
	path: "/deaths/cyclists",
	method: "get",
	tags,
	request: {
		query: z.object({
			year: z.coerce.number().int().min(2015).max(2030).optional(),
			city_code: z.coerce.number().int().optional(),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				total_cyclist_deaths: z.number(),
				year: z.number().nullable(),
				city_code: z.number().nullable(),
				percentage_of_total: z.number(),
				message: z.string(),
			}),
			"Cyclist deaths statistics",
		),
	},
});
