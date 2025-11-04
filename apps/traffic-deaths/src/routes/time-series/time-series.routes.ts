import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const tags = ["Time Series Analysis"];

// GET /v1/deaths/time-series
// Returns deaths over time (year by year)
export const getTimeSeries = createRoute({
	path: "/deaths/time-series",
	method: "get",
	tags,
	request: {
		query: z.object({
			start_year: z.coerce.number().int().min(2015).max(2030).optional(),
			end_year: z.coerce.number().int().min(2015).max(2030).optional(),
			city_code: z.coerce.number().int().optional(),
			transport_mode: z
				.enum([
					"pedestrian",
					"cyclist",
					"motorcyclist",
					"tricycle",
					"car",
					"pickup",
					"heavy_vehicle",
					"bus",
					"other",
					"unspecified",
				])
				.optional(),
			location_type: z
				.enum(["occurrence", "residence"])
				.default("occurrence")
				.optional(),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				start_year: z.number(),
				end_year: z.number(),
				city_code: z.number().nullable(),
				transport_mode: z.string().nullable(),
				location_type: z.enum(["occurrence", "residence"]),
				data: z.array(
					z.object({
						year: z.number(),
						total_deaths: z.number(),
					}),
				),
				total: z.number(),
				average_per_year: z.number(),
			}),
			"Time series of deaths by year",
		),
	},
});
