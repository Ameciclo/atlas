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
	path: "/v1/infrastructure",
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
	path: "/v1/infrastructure/{id}",
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

export const getGeoJSON = createRoute({
	path: "/v1/infrastructure/geojson",
	method: "get",
	tags,
	summary: "Get cycling infrastructure as GeoJSON",
	description: "Get all cycling infrastructure in GeoJSON FeatureCollection format",
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
			z.object({
				type: z.literal("FeatureCollection"),
				features: z.array(z.object({
					type: z.literal("Feature"),
					id: z.string(),
					properties: z.record(z.any()),
					geometry: z.any(),
				})),
			}),
			"Cycling infrastructure in GeoJSON format",
		),
	},
});

export const getNearby = createRoute({
	path: "/v1/infrastructure/nearby",
	method: "get",
	tags,
	summary: "Get existing cycling infrastructure near a location",
	description: "Get existing cycling infrastructure within a radius from a lat/lon point",
	request: {
		query: z.object({
			lat: z.string().openapi({ description: "Latitude", example: "-8.0476" }),
			lon: z.string().openapi({ description: "Longitude", example: "-34.8770" }),
			radius: z.string().optional().openapi({ description: "Radius in meters", example: "1000" }),
			type: z.string().optional().openapi({ description: "Filter by infrastructure type", example: "Ciclofaixa" }),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				type: z.literal("FeatureCollection"),
				features: z.array(z.object({
					type: z.literal("Feature"),
					id: z.string(),
					properties: z.object({
						name: z.string().nullable(),
						infra_type: z.string(),
						distance_meters: z.number(),
					}).and(z.record(z.any())),
					geometry: z.any(),
				})),
				summary: z.object({
					total_infrastructure: z.number(),
					by_type: z.record(z.number()),
				}),
			}),
			"Existing cycling infrastructure near location",
		),
	},
});

export type ListRoute = typeof list;
export type GetByIdRoute = typeof getById;
export type GetGeoJSONRoute = typeof getGeoJSON;
export type GetNearbyRoute = typeof getNearby;
