import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { IdParamsSchema } from "stoker/openapi/schemas";
import { selectCountingSessionSchema } from "../../db/schema.js";
import { notFoundSchema } from "../../lib/constants.js";

const tags = ["Sessions"];

export const getByEventId = createRoute({
	path: "/events/{id}/sessions",
	method: "get",
	tags,
	summary: "Get sessions by event ID",
	description: "Get all counting sessions (hourly periods) for a specific event",
	request: {
		params: IdParamsSchema,
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.array(selectCountingSessionSchema),
			"List of counting sessions for the event",
		),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(
			notFoundSchema,
			"Event not found",
		),
	},
});

export const getById = createRoute({
	path: "/sessions/{id}",
	method: "get",
	tags,
	summary: "Get session by ID",
	description: "Get a specific counting session by its ID",
	request: {
		params: IdParamsSchema,
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			selectCountingSessionSchema,
			"Counting session details",
		),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(
			notFoundSchema,
			"Session not found",
		),
	},
});

export type GetByEventIdRoute = typeof getByEventId;
export type GetByIdRoute = typeof getById;

