import { createRoute, z } from "@hono/zod-openapi";
import { selectSharedBikeStationSchema } from "@atlas/database";

const tags = ["Stations"];

export const listStationsRoute = createRoute({
	method: "get",
	path: "/stations",
	tags,
	summary: "List all bike sharing stations",
	request: {
		query: z.object({
			network: z.string().optional().openapi({
				description: "Filter by network (e.g., 'BikePE')",
				example: "BikePE",
			}),
			operator: z.string().optional().openapi({
				description: "Filter by operator (e.g., 'Tembici')",
				example: "Tembici",
			}),
			min_capacity: z.string().optional().openapi({
				description: "Minimum station capacity",
				example: "15",
			}),
			max_capacity: z.string().optional().openapi({
				description: "Maximum station capacity",
				example: "30",
			}),
		}),
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.array(selectSharedBikeStationSchema),
				},
			},
			description: "List of bike sharing stations",
		},
	},
});

export const getStationRoute = createRoute({
	method: "get",
	path: "/stations/{id}",
	tags,
	summary: "Get a specific bike sharing station",
	request: {
		params: z.object({
			id: z.string().openapi({
				description: "Station ID",
				example: "1",
			}),
		}),
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: selectSharedBikeStationSchema,
				},
			},
			description: "Bike sharing station details",
		},
		404: {
			content: {
				"application/json": {
					schema: z.object({
						error: z.string(),
					}),
				},
			},
			description: "Station not found",
		},
	},
});
export const nearbyStationsRoute = createRoute({
	method: "get",
	path: "/stations/nearby",
	tags,
	summary: "Find nearby bike sharing stations",
	request: {
		query: z.object({
			lat: z.string().openapi({
				description: "Latitude",
				example: "-8.05",
			}),
			lon: z.string().openapi({
				description: "Longitude",
				example: "-34.88",
			}),
			radius: z.string().optional().openapi({
				description: "Search radius in meters",
				example: "1000",
				default: "1000",
			}),
			limit: z.string().optional().openapi({
				description: "Maximum number of results",
				example: "10",
				default: "50",
			}),
		}),
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.array(selectSharedBikeStationSchema),
				},
			},
			description: "List of nearby bike sharing stations",
		},
	},
});