import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { z } from "zod";

const tags = ["Relations"];

export const relationsByCityRoute = createRoute({
	path: "/v1/relations/by-city",
	method: "get",
	summary: "Get relations grouped by city",
	description: "Get all cycling infrastructure relations grouped by city with statistics",
	tags,
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.record(z.object({
				city_id: z.number(),
				name: z.string(),
				state: z.string(),
				relations: z.array(z.object({
					relation_id: z.number(),
					pdc_ref: z.string().nullable(),
					name: z.string().nullable(),
					cod_name: z.string(),
					length: z.number(),
					has_cycleway_length: z.number(),
					pdc_typology: z.string().nullable(),
					typologies_str: z.string(),
					typologies: z.record(z.number()),
				})),
			})),
			"Relations grouped by city with statistics",
		),
	},
});

export type RelationsByCityRoute = typeof relationsByCityRoute;