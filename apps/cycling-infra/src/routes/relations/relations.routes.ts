import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { IdParamsSchema } from "stoker/openapi/schemas";
import {
	selectPdcRelationWaysSchema,
	selectCyclistInfraRelationsSchema,
} from "../../db/schema.js";
import { notFoundSchema } from "../../lib/constants.js";

const tags = ["Relations"];

export const list = createRoute({
	path: "/v1/relations",
	method: "get",
	tags,
	summary: "List all cycling infrastructure relations",
	description: "Get all PDC cycling infrastructure relations",
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.array(selectCyclistInfraRelationsSchema),
			"List of cycling infrastructure relations",
		),
		[HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
			notFoundSchema,
			"Internal server error",
		),
	},
});

export const getById = createRoute({
	path: "/v1/relations/{id}",
	method: "get",
	tags,
	summary: "Get relation by ID",
	description:
		"Get specific cycling infrastructure relation by ID as GeoJSON FeatureCollection",
	request: {
		params: IdParamsSchema,
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				type: z.literal("FeatureCollection"),
				features: z.array(
					z.object({
						type: z.literal("Feature"),
						id: z.string(),
						properties: z.record(z.any()),
						geometry: z.any(),
					}),
				),
			}),
			"Relation as GeoJSON FeatureCollection",
		),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(
			notFoundSchema,
			"Relation not found",
		),
		[HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
			notFoundSchema,
			"Internal server error",
		),
	},
});

export const getWaysByRelationId = createRoute({
	path: "/v1/relations/{id}/ways",
	method: "get",
	tags,
	summary: "Get ways from relation",
	description: "Fetch PDC relation ways for a specific relation by ID",
	request: {
		params: IdParamsSchema,
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.array(selectPdcRelationWaysSchema),
			"Ways from the specified relation",
		),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(
			notFoundSchema,
			"Relation not found",
		),
		[HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
			notFoundSchema,
			"Internal server error",
		),
	},
});

export type ListRoute = typeof list;
export type GetByIdRoute = typeof getById;
export type GetWaysByRelationIdRoute = typeof getWaysByRelationId;
