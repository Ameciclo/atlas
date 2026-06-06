import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

// Original format schema
const OriginalWaySchema = z.object({
	osmId: z.number(),
	name: z.string().nullable(),
	length: z.number(),
	highway: z.string(),
	hasCycleway: z.boolean(),
	cyclewayTypology: z.string(),
	relationId: z.number(),
	geojson: z.object({
		type: z.literal("FeatureCollection"),
		features: z.array(
			z.object({
				id: z.string(),
				type: z.literal("Feature"),
				geometry: z.any(),
				properties: z.record(z.any()),
			}),
		),
	}),
	lastUpdated: z.null(),
	cityId: z.number(),
	dualCarriageway: z.boolean(),
	pdcTypology: z.string(),
});

const tags = ["Ways"];

const WaysSummarySchema = z.object({
	all: z.object({
		pdc_feito: z.number(),
		out_pdc: z.number(),
		pdc_total: z.number(),
		percent: z.number(),
	}),
	byCity: z.record(
		z.object({
			pdc_feito: z.number(),
			out_pdc: z.number(),
			pdc_total: z.number(),
			percent: z.number(),
		}),
	),
});

const GeoJSONFeatureSchema = z.object({
	type: z.literal("Feature"),
	geometry: z.any(),
	properties: z
		.object({
			id: z.union([z.number(), z.string()]).optional(),
			status_type: z.enum(["pdc_realizado_designado", "pdc_realizado_nao_designado", "realizado_fora_pdc", "pdc_nao_realizado"]),
			status_value: z.number(),
			length: z.number(),
			city_id: z.number(),
		})
		.and(z.record(z.any())),
});

const GeoJSONCollectionSchema = z.object({
	type: z.literal("FeatureCollection"),
	features: z.array(GeoJSONFeatureSchema),
});

const AllWaysResponseSchema = z.object({
	all: GeoJSONCollectionSchema,
	byCity: z.record(GeoJSONCollectionSchema),
});

export const list = createRoute({
	path: "/v1/ways",
	method: "get",
	tags,
	summary: "List all PDC ways",
	description: "Get all PDC relation ways",
	request: {
		query: z.object({
			city: z
				.string()
				.optional()
				.openapi({ description: "Filter by city ID", example: "2611606" }),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.array(OriginalWaySchema),
			"List of PDC ways in original format",
		),
	},
});

export const getSummary = createRoute({
	path: "/v1/ways/summary",
	method: "get",
	tags,
	summary: "Get ways summary statistics",
	description: "Get summary statistics of PDC ways implementation",
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			WaysSummarySchema,
			"Ways summary statistics",
		),
	},
});

export const getAll = createRoute({
	path: "/v1/ways/all-ways",
	method: "get",
	tags,
	summary: "Get all ways as GeoJSON",
	description:
		"Get all PDC ways formatted as GeoJSON FeatureCollection with optional filtering and pagination",
	request: {
		query: z.object({
			city: z
				.string()
				.optional()
				.openapi({ description: "Filter by city ID", example: "2611606" }),
			limit: z.string().optional().openapi({
				description: "Maximum number of results (default: 1000)",
				example: "500",
			}),
			offset: z.string().optional().openapi({
				description: "Number of results to skip for pagination",
				example: "0",
			}),
			simplify: z.string().optional().openapi({
				description: "Geometry simplification tolerance (default: 0.0001)",
				example: "0.001",
			}),
			precision: z.string().optional().openapi({
				description:
					"Decimal precision for coordinates (4=~10m, 5=~1m, 6=~0.1m)",
				example: "5",
			}),
			minimal: z.string().optional().openapi({
				description: "Return only essential status properties (true/false)",
				example: "true",
			}),
			only_all: z.string().optional().openapi({
				description:
					"Return only the FeatureCollection without all/byCity structure (true/false)",
				example: "true",
			}),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.union([AllWaysResponseSchema, GeoJSONCollectionSchema]),
			"GeoJSON FeatureCollection of all ways (with or without grouping)",
		),
	},
});

export const getNearby = createRoute({
	path: "/v1/ways/nearby",
	method: "get",
	tags,
	summary: "Get PDC ways near a location",
	description:
		"Get PDC ways within a radius from a lat/lon point with execution status",
	request: {
		query: z.object({
			lat: z.string().openapi({ description: "Latitude", example: "-8.0476" }),
			lon: z
				.string()
				.openapi({ description: "Longitude", example: "-34.8770" }),
			radius: z
				.string()
				.optional()
				.openapi({ description: "Radius in meters", example: "1000" }),
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
								pdc_ref: z.string().nullable(),
								name: z.string().nullable(),
								pdc_typology: z.string().nullable(),
								executed: z.boolean(),
								length_km: z.number(),
								distance_meters: z.number(),
							})
							.and(z.record(z.any())),
						geometry: z.any(),
					}),
				),
				summary: z.object({
					total_ways: z.number(),
					executed_ways: z.number(),
					total_length_km: z.number(),
					executed_length_km: z.number(),
					execution_percentage: z.number(),
				}),
			}),
			"PDC ways near location with execution status",
		),
	},
});

export type ListRoute = typeof list;
export type GetSummaryRoute = typeof getSummary;
export type GetAllRoute = typeof getAll;
export type GetNearbyRoute = typeof getNearby;
