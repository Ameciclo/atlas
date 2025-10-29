import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const tags = ["Transport Mode Analysis"];

// GET /v1/deaths/by-transport-mode
// Returns deaths grouped by transport mode (based on CID-10 codes)
export const getDeathsByTransportMode = createRoute({
	path: "/deaths/by-transport-mode",
	method: "get",
	tags,
	request: {
		query: z.object({
			year: z.coerce.number().int().min(2015).max(2030).optional(),
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
				year: z.number().nullable(),
				city_code: z.number().nullable(),
				location_type: z.enum(["occurrence", "residence"]),
				transport_modes: z.array(
					z.object({
						mode: z.string(),
						cid10_codes: z.string(),
						total_deaths: z.number(),
						percentage: z.number(),
					}),
				),
				total: z.number(),
			}),
			"Deaths grouped by transport mode",
		),
	},
});
