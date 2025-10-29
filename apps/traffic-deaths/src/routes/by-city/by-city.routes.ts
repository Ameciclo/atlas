import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const tags = ["Geographic Analysis"];

// GET /v1/deaths/by-city
// Returns deaths grouped by city
export const getDeathsByCity = createRoute({
	path: "/deaths/by-city",
	method: "get",
	tags,
	request: {
		query: z.object({
			year: z.coerce.number().int().min(2015).max(2030).optional(),
			location_type: z
				.enum(["occurrence", "residence"])
				.default("occurrence")
				.optional(),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				location_type: z.enum(["occurrence", "residence"]),
				year: z.number().nullable(),
				cities: z.array(
					z.object({
						city_code: z.number(),
						city_name: z.string().nullable(),
						total_deaths: z.number(),
					}),
				),
				total: z.number(),
			}),
			"Deaths grouped by city",
		),
	},
});
