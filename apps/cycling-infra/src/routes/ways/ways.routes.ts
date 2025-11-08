import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { selectPdcRelationWaysSchema } from "../../db/schema.js";

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
		features: z.array(z.object({
			id: z.string(),
			type: z.literal("Feature"),
			geometry: z.any(),
			properties: z.record(z.any())
		}))
	}),
	lastUpdated: z.null(),
	cityId: z.number(),
	dualCarriageway: z.boolean(),
	pdcTypology: z.string()
});

const tags = ["Ways"];

const WaysSummarySchema = z.object({
	all: z.object({
		pdc_feito: z.number(),
		out_pdc: z.number(),
		pdc_total: z.number(),
		percent: z.number(),
	}),
	byCity: z.record(z.object({
		pdc_feito: z.number(),
		out_pdc: z.number(),
		pdc_total: z.number(),
		percent: z.number(),
	})),
});

const GeoJSONFeatureSchema = z.object({
	type: z.literal("Feature"),
	geometry: z.any(),
	properties: z.object({
		STATUS: z.enum(["Realizada", "Projeto", "NotPDC"]),
	}).and(z.record(z.any())),
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
			city: z.string().optional().openapi({ description: "Filter by city ID", example: "2611606" }),
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
	description: "Get all PDC ways formatted as GeoJSON FeatureCollection",
	request: {
		query: z.object({
			city: z.string().optional().openapi({ description: "Filter by city ID", example: "2611606" }),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			AllWaysResponseSchema,
			"GeoJSON FeatureCollection of all ways",
		),
	},
});

export const getNearby = createRoute({
	path: "/v1/ways/nearby",
	method: "get",
	tags,
	summary: "Get PDC ways near a location",
	description: "Get PDC ways within a radius from a lat/lon point with execution status",
	request: {
		query: z.object({
			lat: z.string().openapi({ description: "Latitude", example: "-8.0476" }),
			lon: z.string().openapi({ description: "Longitude", example: "-34.8770" }),
			radius: z.string().optional().openapi({ description: "Radius in meters", example: "1000" }),
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
						pdc_ref: z.string().nullable(),
						name: z.string().nullable(),
						pdc_typology: z.string().nullable(),
						executed: z.boolean(),
						length_km: z.number(),
						distance_meters: z.number(),
					}).and(z.record(z.any())),
					geometry: z.any(),
				})),
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