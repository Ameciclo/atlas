import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { IdParamsSchema } from "stoker/openapi/schemas";
import { selectGeolocatedCrashSchema } from "@atlas/database/schemas/traffic-crashes";
import { notFoundSchema } from "../../lib/constants.js";

const tags = ["Crashes"];

export const list = createRoute({
	path: "/crashes",
	method: "get",
	tags,
	summary: "List all geolocated crashes",
	description:
		"Get all traffic crashes with geographic coordinates, optionally filtered by date range",
	request: {
		query: z.object({
			start_date: z.string().optional().openapi({
				description: "Filter crashes from this date (YYYY-MM-DD)",
				example: "2023-01-01",
			}),
			end_date: z.string().optional().openapi({
				description: "Filter crashes until this date (YYYY-MM-DD)",
				example: "2023-12-31",
			}),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.array(selectGeolocatedCrashSchema),
			"List of geolocated crashes",
		),
	},
});

export const getById = createRoute({
	path: "/crashes/{id}",
	method: "get",
	tags,
	summary: "Get crash by ID",
	description: "Get a specific traffic crash by its ID",
	request: {
		params: IdParamsSchema,
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			selectGeolocatedCrashSchema,
			"Traffic crash details",
		),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "Crash not found"),
	},
});

export type ListRoute = typeof list;
export type GetByIdRoute = typeof getById;
