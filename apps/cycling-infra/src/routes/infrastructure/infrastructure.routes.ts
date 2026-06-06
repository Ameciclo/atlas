import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { IdParamsSchema } from "stoker/openapi/schemas";
import { notFoundSchema } from "../../lib/constants.js";

const tags = ["Infrastructure"];

const InfrastructureSchema = z.object({
	id: z.number().openapi({ description: "Unique identifier", example: 1 }),
	osm_id: z
		.string()
		.openapi({ description: "OpenStreetMap ID", example: "way/123456" }),
	name: z.string().nullable().openapi({
		description: "Infrastructure name",
		example: "Ciclofaixa da Rua da Aurora",
	}),
	infra_type: z.string().openapi({
		description: "Type of cycling infrastructure",
		example: "Ciclofaixa",
	}),
	coordinates: z.any().openapi({ description: "PostGIS geometry coordinates" }),
	geojson: z
		.any()
		.openapi({ description: "GeoJSON representation of the infrastructure" }),
	created_at: z.string().openapi({
		description: "Creation timestamp",
		example: "2024-01-01T00:00:00Z",
	}),
	updated_at: z.string().openapi({
		description: "Last update timestamp",
		example: "2024-01-01T00:00:00Z",
	}),
});

export const list = createRoute({
	path: "/v1/infrastructure",
	method: "get",
	tags,
	summary: "List cycling infrastructure",
	description:
		"This endpoint is deprecated. Use /v1/ways/all-ways and /v1/ways/summary instead.",
	request: {
		query: z.object({
			type: z.string().optional().openapi({
				description:
					"Filter by infrastructure type (Ciclofaixa, Ciclovia, Faixa Compartilhada, etc.)",
				example: "Ciclofaixa",
			}),
			limit: z.string().optional().openapi({
				description: "Limit number of results (max 1000)",
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
	path: "/v1/infrastructure-geojson",
	method: "get",
	tags,
	summary: "Get cycling infrastructure as GeoJSON",
	description:
		"Get all cycling infrastructure in GeoJSON FeatureCollection format",
	request: {
		query: z.object({
			type: z.string().optional().openapi({
				description:
					"Filter by infrastructure type (Ciclofaixa, Ciclovia, Faixa Compartilhada, etc.)",
				example: "Ciclofaixa",
			}),
			limit: z.string().optional().openapi({
				description: "Limit number of results (max 1000)",
				example: "100",
			}),
		}),
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
			"Cycling infrastructure in GeoJSON format",
		),
	},
});

export const getNearby = createRoute({
	path: "/v1/infrastructure-nearby",
	method: "get",
	tags,
	summary: "Get existing cycling infrastructure near a location",
	description:
		"Get existing cycling infrastructure within a radius from a lat/lon point",
	request: {
		query: z.object({
			lat: z
				.string()
				.openapi({ description: "Latitude coordinate", example: "-8.0476" }),
			lon: z
				.string()
				.openapi({ description: "Longitude coordinate", example: "-34.8770" }),
			radius: z.string().optional().openapi({
				description: "Search radius in meters (default: 1000, max: 10000)",
				example: "1000",
			}),
			type: z.string().optional().openapi({
				description: "Filter by infrastructure type",
				example: "Ciclofaixa",
			}),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				type: z.literal("FeatureCollection"),
				features: z.array(
					z.object({
						type: z.literal("Feature"),
						id: z.string(),
						properties: z
							.object({
								name: z.string().nullable(),
								infra_type: z.string(),
								distance_meters: z.number(),
							})
							.and(z.record(z.any())),
						geometry: z.any(),
					}),
				),
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
