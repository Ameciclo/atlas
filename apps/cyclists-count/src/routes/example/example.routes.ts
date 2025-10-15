import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { selectCyclistsCountSchema } from "../../db/schema.js";

const tags = ["Cyclists Counts"];

export const list = createRoute({
	path: "/v1/cyclists-counts",
	method: "get",
	tags,
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.array(selectCyclistsCountSchema),
			"List of cyclists counts",
		),
	},
});

export const getById = createRoute({
	path: "/v1/cyclists-counts/{id}",
	method: "get",
	tags,
	request: {
		params: z.object({
			id: z.string().transform(Number),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			selectCyclistsCountSchema,
			"Cyclists count by ID",
		),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(
			z.object({ message: z.string() }),
			"Cyclists count not found",
		),
	},
});

export type ListRoute = typeof list;
export type GetByIdRoute = typeof getById;
