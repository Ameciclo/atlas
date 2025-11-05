import { createRoute, z } from "@hono/zod-openapi";
import { selectTrafficViolationSchema } from "../../db/schema.js";

// ============================================================================
// Query Parameters Schemas
// ============================================================================

const listViolationsQuerySchema = z.object({
	start_date: z.string().date().optional().openapi({
		description: "Filter violations from this date (YYYY-MM-DD)",
		example: "2023-01-01",
	}),
	end_date: z.string().date().optional().openapi({
		description: "Filter violations until this date (YYYY-MM-DD)",
		example: "2023-12-31",
	}),
	agent_id: z.coerce.number().int().positive().optional().openapi({
		description: "Filter by agent ID",
		example: 1,
	}),
	violation_type_id: z.coerce.number().int().positive().optional().openapi({
		description: "Filter by violation type ID",
		example: 5,
	}),
	location_id: z.coerce.number().int().positive().optional().openapi({
		description: "Filter by location ID",
		example: 10,
	}),
	limit: z.coerce
		.number()
		.int()
		.min(1)
		.max(100)
		.default(10)
		.optional()
		.openapi({
			description: "Number of records to return (1-100)",
			example: 10,
		}),
	offset: z.coerce.number().int().min(0).default(0).optional().openapi({
		description: "Number of records to skip",
		example: 0,
	}),
});

const violationParamsSchema = z.object({
	id: z.coerce.number().int().positive().openapi({
		description: "Traffic violation ID",
		example: 1,
	}),
});

export type ViolationsByLocationRoute = typeof violationsByLocationRoute;
export type ViolationsHotspotsRoute = typeof violationsHotspotsRoute;
export type ViolationsGeoJSONRoute = typeof violationsGeoJSONRoute;

// ============================================================================
// Response Schemas
// ============================================================================

const violationResponseSchema = selectTrafficViolationSchema.openapi({
	description: "Traffic violation data",
});

const violationsListResponseSchema = z.array(violationResponseSchema).openapi({
	description: "List of traffic violations",
});

// ============================================================================
// Route Definitions
// ============================================================================

export const listViolationsRoute = createRoute({
	method: "get",
	path: "/violations",
	tags: ["Traffic Violations"],
	summary: "List traffic violations",
	description: "Retrieve a list of traffic violations with optional filters",
	request: {
		query: listViolationsQuerySchema,
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: violationsListResponseSchema,
				},
			},
			description: "List of traffic violations",
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

export const getViolationRoute = createRoute({
	method: "get",
	path: "/violations/{id}",
	tags: ["Traffic Violations"],
	summary: "Get traffic violation by ID",
	description: "Retrieve a specific traffic violation by its ID",
	request: {
		params: violationParamsSchema,
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: violationResponseSchema,
				},
			},
			description: "Traffic violation data",
		},
		404: {
			content: {
				"application/json": {
					schema: z.object({
						error: z.string(),
					}),
				},
			},
			description: "Traffic violation not found",
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

export const violationsByLocationRoute = createRoute({
	method: "get",
	path: "/violations/by-location",
	tags: ["Traffic Violations"],
	summary: "Get violations by location",
	description: "Get violations grouped by location",
	request: {
		query: z.object({
			start_date: z.string().date().optional().openapi({
				description: "Start date (YYYY-MM-DD)",
				example: "2023-01-01",
			}),
			end_date: z.string().date().optional().openapi({
				description: "End date (YYYY-MM-DD)",
				example: "2023-12-31",
			}),
			limit: z.coerce.number().min(1).max(100).default(50).optional().openapi({
				description: "Number of results",
				example: 50,
			}),
		}),
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						locations: z.array(z.object({
							location_id: z.number(),
							location_description: z.string(),
							total_violations: z.number(),
							ranking: z.number(),
							coordinates: z.string().nullable(),
						})),
					}),
				},
			},
			description: "Violations by location",
		},
	},
});

export const violationsHotspotsRoute = createRoute({
	method: "get",
	path: "/violations/hotspots",
	tags: ["Traffic Violations"],
	summary: "Get violation hotspots",
	description: "Get clustered violation hotspots in GeoJSON format",
	request: {
		query: z.object({
			violation_type_id: z.coerce.number().optional().openapi({
				description: "Filter by violation type ID",
				example: 5,
			}),
			limit: z.coerce.number().min(1).max(100).default(50).optional().openapi({
				description: "Number of hotspots",
				example: 50,
			}),
			radius_km: z.coerce.number().min(0.1).max(10).default(1).optional().openapi({
				description: "Clustering radius in kilometers",
				example: 1,
			}),
		}),
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						type: z.literal("FeatureCollection"),
						features: z.array(z.object({
							type: z.literal("Feature"),
							geometry: z.object({
								type: z.literal("Point"),
								coordinates: z.array(z.number()),
							}),
							properties: z.object({
								violations_count: z.number(),
								radius_km: z.number(),
								violation_types: z.array(z.string()),
							}),
						})),
					}),
				},
			},
			description: "Violation hotspots GeoJSON",
		},
	},
});

export const violationsGeoJSONRoute = createRoute({
	method: "get",
	path: "/violations/geojson",
	tags: ["Traffic Violations"],
	summary: "Get violations GeoJSON",
	description: "Get violations in GeoJSON format",
	request: {
		query: z.object({
			start_date: z.string().date().optional().openapi({
				description: "Start date (YYYY-MM-DD)",
				example: "2023-01-01",
			}),
			end_date: z.string().date().optional().openapi({
				description: "End date (YYYY-MM-DD)",
				example: "2023-12-31",
			}),
			violation_type_id: z.coerce.number().optional().openapi({
				description: "Filter by violation type ID",
				example: 5,
			}),
			agent_id: z.coerce.number().optional().openapi({
				description: "Filter by agent ID",
				example: 142,
			}),
			limit: z.coerce.number().min(1).max(1000).default(100).optional().openapi({
				description: "Number of violations",
				example: 100,
			}),
		}),
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						type: z.literal("FeatureCollection"),
						features: z.array(z.object({
							type: z.literal("Feature"),
							geometry: z.object({
								type: z.literal("Point"),
								coordinates: z.array(z.number()),
							}),
							properties: z.object({
								violation_type: z.string(),
								agent_id: z.number(),
								date: z.string(),
								description: z.string(),
							}),
						})),
					}),
				},
			},
			description: "Violations GeoJSON",
		},
	},
});
