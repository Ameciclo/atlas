import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const tags = ["Statistics"];

// GET /v1/stats
// Returns comprehensive statistics including growth rates and most violent year
export const getStats = createRoute({
	path: "/stats",
	method: "get",
	tags,
	request: {
		query: z.object({
			city_code: z.coerce.number().int().optional(),
			location_type: z
				.enum(["occurrence", "residence"])
				.default("occurrence")
				.optional(),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				city_code: z.number().nullable(),
				location_type: z.enum(["occurrence", "residence"]),
				latest_year: z.number(),
				latest_year_deaths: z.number(),
				previous_year_deaths: z.number(),
				growth_percentage: z.number(),
				most_violent_year: z.object({
					year: z.number(),
					total_deaths: z.number(),
				}),
				last_5_years: z.object({
					total_deaths: z.number(),
					average_per_year: z.number(),
				}),
				all_time: z.object({
					total_deaths: z.number(),
					years_covered: z.number(),
					average_per_year: z.number(),
				}),
			}),
			"Comprehensive statistics summary",
		),
	},
});
