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

const EventDetailsSchema = z.object({
	id: z.number(),
	slug: z.string(),
	name: z.string(),
	date: z.string(),
	city: z.object({
		id: z.number(),
		name: z.string(),
		state: z.string(),
		full_state: z.string(),
		rmr: z.boolean(),
	}),
	coordinates: z.array(z.object({
		point: z.object({
			x: z.number(),
			y: z.number(),
		}),
		type: z.string(),
		name: z.string(),
	})),
	directions: z.record(z.string()),
	sessions: z.record(z.object({
		start_time: z.string(),
		end_time: z.string(),
		total_cyclists: z.number(),
		quantitative: z.record(z.number()),
		characteristics: z.record(z.number()),
	})),
	summary: z.object({
		max_hour: z.number(),
		total_cyclists: z.number(),
		total_cargo: z.number(),
		total_helmet: z.number(),
		total_juveniles: z.number(),
		total_motor: z.number(),
		total_ride: z.number(),
		total_service: z.number(),
		total_shared_bike: z.number(),
		total_sidewalk: z.number(),
		total_women: z.number(),
		total_wrong_way: z.number(),
	}),
});

export const getDetailsById = createRoute({
	path: "/events/{id}/details",
	method: "get",
	tags,
	summary: "Get detailed event data by ID",
	description: "Get comprehensive event details including sessions, characteristics, directions and summary",
	request: {
		params: IdParamsSchema,
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			EventDetailsSchema,
			"Detailed event data",
		),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "Event not found"),
	},
});

export type ListRoute = typeof list;
export type GetByIdRoute = typeof getById;
export type GetByLocationIdRoute = typeof getByLocationId;
export type GetDetailsByIdRoute = typeof getDetailsById;
