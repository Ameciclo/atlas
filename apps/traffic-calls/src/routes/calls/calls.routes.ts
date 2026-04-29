import { createRoute, z } from "@hono/zod-openapi";
import { selectTrafficCallSchema } from "../../db/schema.js";

// ============================================================================
// Query Parameters Schemas
// ============================================================================

const listQuerySchema = z.object({
	start_date: z
		.string()
		.optional()
		.openapi({
			param: {
				name: "start_date",
				in: "query",
			},
			example: "2023-01-01",
			description: "Filter calls from this date (YYYY-MM-DD)",
		}),
	end_date: z
		.string()
		.optional()
		.openapi({
			param: {
				name: "end_date",
				in: "query",
			},
			example: "2023-12-31",
			description: "Filter calls until this date (YYYY-MM-DD)",
		}),
	nature: z
		.string()
		.optional()
		.openapi({
			param: {
				name: "nature",
				in: "query",
			},
			example: "COLISÃO",
			description: "Filter by call nature",
		}),
	neighborhood: z
		.string()
		.optional()
		.openapi({
			param: {
				name: "neighborhood",
				in: "query",
			},
			example: "BOA VIAGEM",
			description: "Filter by neighborhood",
		}),
});

const paramsSchema = z.object({
	id: z
		.string()
		.min(1)
		.openapi({
			param: {
				name: "id",
				in: "path",
			},
			example: "1",
			description: "Traffic call ID",
		}),
});

// ============================================================================
// Response Schemas
// ============================================================================

const callsListResponseSchema = z.object({
	data: z.array(selectTrafficCallSchema),
	total: z.number(),
});

const callResponseSchema = z.object({
	data: selectTrafficCallSchema.nullable(),
});

const errorResponseSchema = z.object({
	error: z.string(),
	message: z.string(),
});

// ============================================================================
// Routes
// ============================================================================

export const listCallsRoute = createRoute({
	method: "get",
	path: "/calls",
	request: {
		query: listQuerySchema,
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: callsListResponseSchema,
				},
			},
			description: "List of traffic calls",
		},
		500: {
			content: {
				"application/json": {
					schema: errorResponseSchema,
				},
			},
			description: "Internal server error",
		},
	},
	tags: ["Traffic Calls"],
	summary: "List traffic calls",
	description: "Get a list of traffic calls with optional filters",
});

export const getCallRoute = createRoute({
	method: "get",
	path: "/calls/{id}",
	request: {
		params: paramsSchema,
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: callResponseSchema,
				},
			},
			description: "Traffic call details",
		},
		404: {
			content: {
				"application/json": {
					schema: errorResponseSchema,
				},
			},
			description: "Traffic call not found",
		},
		500: {
			content: {
				"application/json": {
					schema: errorResponseSchema,
				},
			},
			description: "Internal server error",
		},
	},
	tags: ["Traffic Calls"],
	summary: "Get traffic call by ID",
	description: "Get details of a specific traffic call",
});
