import { createRoute, z } from "@hono/zod-openapi";

const tags = ["Streets"];

export const listStreetsRoute = createRoute({
	method: "get",
	path: "/streets",
	tags,
	summary: "List official streets",
	description:
		"Get a paginated list of official streets with optional filtering",
	request: {
		query: z.object({
			page: z.coerce.number().min(1).default(1).openapi({
				description: "Page number",
				example: 1,
			}),
			limit: z.coerce.number().min(1).max(100).default(20).openapi({
				description: "Number of items per page",
				example: 20,
			}),
			search: z.string().optional().openapi({
				description: "Search in street names",
				example: "rua",
			}),
		}),
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						data: z.array(
							z.object({
								id: z.number(),
								code: z.number(),
								name_concatenated: z.string(),
								official_name: z.string(),
								short_name: z.string(),
								pavement_code: z.string().nullable(),
								pavement_description: z.string().nullable(),
							}),
						),
						pagination: z.object({
							page: z.number(),
							limit: z.number(),
							total: z.number(),
							totalPages: z.number(),
						}),
					}),
				},
			},
			description: "List of streets",
		},
		500: {
			content: {
				"application/json": {
					schema: z.object({
						error: z.string(),
					}),
				},
			},
			description: "Internal server error",
		},
	},
});

export const streetsNearbyRoute = createRoute({
	method: "get",
	path: "/streets/nearby",
	tags,
	summary: "Find streets near a GPS point with violation data",
	description:
		"Given lat/lng, returns nearby streets with GeoJSON geometry, distance, total violations, per-year breakdown, and top violation. Uses PostGIS ST_DWithin on pcr_streets.",
	request: {
		query: z.object({
			lat: z.coerce.number().min(-90).max(90).openapi({
				description: "Latitude",
				example: -8.05,
			}),
			lng: z.coerce.number().min(-180).max(180).openapi({
				description: "Longitude",
				example: -34.9,
			}),
			radius: z.coerce.number().min(1).max(500).default(50).openapi({
				description: "Search radius in meters",
				example: 50,
			}),
			limit: z.coerce.number().int().min(1).max(50).default(10).openapi({
				description: "Maximum number of streets to return",
				example: 5,
			}),
		}),
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						type: z.literal("FeatureCollection"),
						features: z.array(
							z.object({
								type: z.literal("Feature"),
								geometry: z.any(),
								properties: z.object({
									street_code: z.number(),
									street_name: z.string(),
									distance_meters: z.number(),
									total_violations: z.number(),
									extension_km: z.number(),
									violations_per_km: z.number(),
									by_year: z.record(z.string(), z.number()),
									top_violation: z
										.object({
											description: z.string(),
											percentage: z.number(),
										})
										.nullable(),
								}),
							}),
						),
					}),
				},
			},
			description: "Nearby streets with violation data as GeoJSON",
		},
	},
});

export const streetsGeoJSONRoute = createRoute({
	method: "get",
	path: "/streets/geojson",
	tags,
	summary: "Streets GeoJSON with violation counts (all years)",
	description:
		"Retorna as top N ruas (union top-all-time + top-per-year) como FeatureCollection GeoJSON. Cada Feature inclui contagens por ano para filtragem client-side.",
	request: {
		query: z.object({
			category: z.string().optional().openapi({
				description:
					"Filter by category (exact match against traffic_tickets_catalog.category)",
				example: "Velocidade",
			}),
			law: z.string().optional().openapi({
				description:
					"Filter by law article prefix (normalized: lowercase, no spaces). Matches law_code_search.",
				example: "Art. 181",
			}),
			cyclist: z.coerce.boolean().optional().openapi({
				description:
					"Filter to only cyclist-related violations (distance, bike lanes, door opening, etc.)",
			}),
			limit: z.coerce
				.number()
				.int()
				.min(1)
				.max(500)
				.default(100)
				.optional()
				.openapi({
					description:
						"Number of top streets per group (all-time + per-year). Final count is the union.",
					example: 100,
				}),
			simplify_tolerance: z.coerce
				.number()
				.min(0)
				.max(0.01)
				.default(0.0001)
				.optional()
				.openapi({
					description:
						"ST_Simplify tolerance in degrees (~0.0001 = 10m). Higher = faster, less precise geometry",
					example: 0.001,
				}),
		}),
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						type: z.literal("FeatureCollection"),
						features: z.array(
							z.object({
								type: z.literal("Feature"),
								geometry: z.object({
									type: z.literal("MultiLineString"),
									coordinates: z.array(z.array(z.array(z.number()))),
								}),
								properties: z.object({
									street_code: z.number(),
									street_name: z.string(),
									total_violations: z.number(),
									extension_km: z.number(),
									violations_per_km: z.number(),
									by_year: z.record(z.string(), z.number()),
									top_violation: z
										.object({
											description: z.string(),
											percentage: z.number(),
										})
										.nullable(),
								}),
							}),
						),
					}),
				},
			},
			description: "Streets GeoJSON with violation counts per year",
		},
	},
});
