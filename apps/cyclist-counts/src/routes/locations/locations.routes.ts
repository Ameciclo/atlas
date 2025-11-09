import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { IdParamsSchema } from "stoker/openapi/schemas";
import { selectCountingLocationSchema } from "../../db/schema.js";
import { notFoundSchema } from "../../lib/constants.js";

const tags = ["Locations"];

export const list = createRoute({
	path: "/locations",
	method: "get",
	tags,
	summary: "List all counting locations",
	description:
		"Get all cyclist counting locations, optionally filtered by city",
	request: {
		query: z.object({
			city: z.string().optional().openapi({
				description: "Filter locations by city name",
				example: "Recife",
			}),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.array(selectCountingLocationSchema),
			"List of counting locations",
		),
	},
});

export const getById = createRoute({
	path: "/locations/{id}",
	method: "get",
	tags,
	summary: "Get location by ID",
	description: "Get a specific counting location by its ID",
	request: {
		params: IdParamsSchema,
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			selectCountingLocationSchema,
			"Counting location details",
		),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(
			notFoundSchema,
			"Location not found",
		),
	},
});

export const getNearby = createRoute({
	path: "/locations/nearby",
	method: "get",
	tags,
	summary: "Get counting locations near a point",
	description: "Get cyclist counting locations within a radius from a lat/lon point",
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
					id: z.number(),
					properties: z.object({
						name: z.string(),
						city: z.string(),
						distance_meters: z.number(),
						total_cyclists: z.number(),
						years: z.array(z.number()),
					}).and(z.record(z.any())),
					geometry: z.object({
						type: z.literal("Point"),
						coordinates: z.array(z.number()),
					}),
				})),
				summary: z.object({
					total_locations: z.number(),
					total_cyclists: z.number(),
					by_city: z.record(z.number()),
				}),
			}),
			"Counting locations near the specified point",
		),
	},
});

export type ListRoute = typeof list;
export type GetByIdRoute = typeof getById;
export type GetNearbyRoute = typeof getNearby;
