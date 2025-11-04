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
