import { createRoute, z } from "@hono/zod-openapi";
import { selectTrafficViolationSchema } from "../../db/schema.js";

// ============================================================================
// Query Parameters Schemas
// ============================================================================

const listViolationsQuerySchema = z.object({
	month: z.coerce.number().int().min(1).max(12).openapi({
		description: "Filter by month (1-12). Required parameter",
		example: 12,
	}),
	year: z.coerce.number().int().min(2020).max(2030).openapi({
		description: "Filter by year. Required parameter",
		example: 2023,
	}),
	agent_id: z.coerce.number().int().positive().optional().openapi({
		description: "Filter by agent ID",
		example: 1,
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
			month: z.coerce.number().int().min(1).max(12).openapi({
				description: "Filter by month (1-12). Required parameter",
				example: 12,
			}),
			year: z.coerce.number().int().min(2020).max(2030).openapi({
				description: "Filter by year. Required parameter",
				example: 2023,
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
						locations: z.array(
							z.object({
								location_id: z.number(),
								location_description: z.string(),
								total_violations: z.number(),
								ranking: z.number(),
							}),
						),
					}),
				},
			},
			description: "Violations by location",
		},
	},
});
