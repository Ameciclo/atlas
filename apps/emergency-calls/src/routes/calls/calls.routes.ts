import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { IdParamsSchema } from "stoker/openapi/schemas";
import { selectEmergencyCallSchema } from "../../db/schema.js";
import { notFoundSchema } from "../../lib/constants.js";

const tags = ["Emergency Calls"];

export const list = createRoute({
	path: "/calls",
	method: "get",
	tags,
	summary: "List emergency calls",
	description: "Get emergency calls with optional filters and pagination",
	request: {
		query: z.object({
			municipality: z.string().optional().openapi({
				description: "Filter by municipality",
				example: "RECIFE",
			}),
			subtype: z.string().optional().openapi({
				description: "Filter by accident subtype",
				example: "ACIDENTMOTO",
			}),
			start_date: z.string().date().optional().default("2020-01-01").openapi({
				description:
					"Filter from this date (inclusive). Defaults to 2020-01-01",
				example: "2018-01-01",
			}),
			end_date: z.string().date().optional().openapi({
				description: "Filter until this date (inclusive)",
				example: "2018-12-31",
			}),
			limit: z.coerce.number().int().positive().max(1000).default(100).openapi({
				description: "Maximum number of results",
				example: 100,
			}),
			offset: z.coerce.number().int().min(0).default(0).openapi({
				description: "Number of results to skip",
				example: 0,
			}),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				data: z.array(selectEmergencyCallSchema),
				total: z.number(),
				limit: z.number(),
				offset: z.number(),
			}),
			"List of emergency calls with pagination",
		),
	},
});

export const getById = createRoute({
	path: "/calls/{id}",
	method: "get",
	tags,
	summary: "Get emergency call by ID",
	description: "Get a specific emergency call by its ID",
	request: {
		params: IdParamsSchema,
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			selectEmergencyCallSchema,
			"Emergency call details",
		),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "Call not found"),
	},
});

export type ListRoute = typeof list;
export type GetByIdRoute = typeof getById;
