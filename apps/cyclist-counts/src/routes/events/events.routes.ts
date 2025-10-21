import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { IdParamsSchema } from "stoker/openapi/schemas";
import { selectCountingEventSchema } from "../../db/schema.js";
import { notFoundSchema } from "../../lib/constants.js";

const tags = ["Events"];

export const list = createRoute({
	path: "/events",
	method: "get",
	tags,
	summary: "List all counting events",
	description:
		"Get all cyclist counting events, optionally filtered by location, city, or date range",
	request: {
		query: z.object({
			location_id: z.coerce.number().int().positive().optional().openapi({
				description: "Filter events by location ID",
				example: 1,
			}),
			city: z.string().optional().openapi({
				description: "Filter events by city name",
				example: "Recife",
			}),
			start_date: z.string().date().optional().openapi({
				description: "Filter events from this date (inclusive)",
				example: "2023-01-01",
			}),
			end_date: z.string().date().optional().openapi({
				description: "Filter events until this date (inclusive)",
				example: "2023-12-31",
			}),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.array(selectCountingEventSchema),
			"List of counting events",
		),
	},
});

export const getById = createRoute({
	path: "/events/{id}",
	method: "get",
	tags,
	summary: "Get event by ID",
	description: "Get a specific counting event by its ID",
	request: {
		params: IdParamsSchema,
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			selectCountingEventSchema,
			"Counting event details",
		),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "Event not found"),
	},
});

export const getByLocationId = createRoute({
	path: "/locations/{id}/events",
	method: "get",
	tags,
	summary: "Get events by location ID",
	description: "Get all counting events for a specific location",
	request: {
		params: IdParamsSchema,
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.array(selectCountingEventSchema),
			"List of counting events for the location",
		),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(
			notFoundSchema,
			"Location not found",
		),
	},
});

export type ListRoute = typeof list;
export type GetByIdRoute = typeof getById;
export type GetByLocationIdRoute = typeof getByLocationId;
