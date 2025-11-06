import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { IdParamsSchema } from "stoker/openapi/schemas";
import { notFoundSchema } from "../../lib/constants.js";

const tags = ["Infrastructure"];

const InfrastructureSchema = z.object({
	id: z.number(),
	osm_id: z.string(),
	name: z.string().nullable(),
	infra_type: z.string(),
	coordinates: z.any(), // PostGIS geometry
	geojson: z.any(),
	created_at: z.string(),
	updated_at: z.string(),
});

export const list = createRoute({
	path: "/infrastructure",
	method: "get",
	tags,
	summary: "List cycling infrastructure",
	description: "Get all cycling infrastructure from ciclomapa (existing infrastructure)",
	request: {
		query: z.object({
			type: z.string().optional().openapi({
				description: "Filter by infrastructure type",
				example: "Ciclofaixa",
			}),
			limit: z.string().optional().openapi({
				description: "Limit number of results",
				example: "100",
			}),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.array(InfrastructureSchema),
			"List of cycling infrastructure",
		),
	},
});

export const getById = createRoute({
	path: "/infrastructure/{id}",
	method: "get",
	tags,
	summary: "Get infrastructure by ID",
	description: "Get specific cycling infrastructure by ID",
	request: {
		params: IdParamsSchema,
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			InfrastructureSchema,
			"Infrastructure details",
		),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(
			notFoundSchema,
			"Infrastructure not found",
		),
	},
});

export type ListRoute = typeof list;
export type GetByIdRoute = typeof getById;
