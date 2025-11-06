import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { selectPdcRelationWaysSchema } from "../../db/schema.js";

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
	path: "/ways",
	method: "get",
	tags,
	summary: "List all PDC ways",
	description: "Get all PDC relation ways",
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.array(selectPdcRelationWaysSchema),
			"List of PDC ways",
		),
	},
});

export const getSummary = createRoute({
	path: "/ways/summary",
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
	path: "/ways/all-ways",
	method: "get",
	tags,
	summary: "Get all ways as GeoJSON",
	description: "Get all PDC ways formatted as GeoJSON FeatureCollection",
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			AllWaysResponseSchema,
			"GeoJSON FeatureCollection of all ways",
		),
	},
});

export type ListRoute = typeof list;
export type GetSummaryRoute = typeof getSummary;
export type GetAllRoute = typeof getAll;