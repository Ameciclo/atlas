import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { IdParamsSchema } from "stoker/openapi/schemas";
import { selectCountingLocationSchema } from "../../db/schema.js";
import { notFoundSchema } from "../../lib/constants.js";

const tags = ["Locations"];

export const list = createRoute({
	path: "/locations",
	method: "get",
	tags,
	summary: "List all counting locations",
	description:
		"Get all cyclist counting locations, optionally filtered by city",
	request: {
		query: z.object({
			city: z.string().optional().openapi({
				description: "Filter locations by city name",
				example: "Recife",
			}),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.array(selectCountingLocationSchema),
			"List of counting locations",
		),
	},
});

export const getById = createRoute({
	path: "/locations/{id}",
	method: "get",
	tags,
	summary: "Get location by ID",
	description: "Get a specific counting location by its ID",
	request: {
		params: IdParamsSchema,
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			selectCountingLocationSchema,
			"Counting location details",
		),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(
			notFoundSchema,
			"Location not found",
		),
	},
});

export type ListRoute = typeof list;
export type GetByIdRoute = typeof getById;
