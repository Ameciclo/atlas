import { createRoute, z } from "@hono/zod-openapi";
import { errorResponseSchema } from "../../lib/schemas.js";

const dataSummaryParamsSchema = z.object({
	streetId: z.string(),
});

const dataSummaryResponseSchema = z.object({
	street_id: z.string(),
	street_name: z.string(),
	data_summary: z.unknown(),
});

export const streetDataSummaryRoute = createRoute({
	method: "get",
	path: "/streets/{streetId}/data-summary",
	summary: "Get data availability summary for a street",
	description: "Returns counts of available data types for a specific street",
	request: {
		params: dataSummaryParamsSchema,
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: dataSummaryResponseSchema,
				},
			},
			description: "Street data summary",
		},
		400: {
			content: {
				"application/json": {
					schema: errorResponseSchema,
				},
			},
			description: "Bad request",
		},
		404: {
			content: {
				"application/json": {
					schema: errorResponseSchema,
				},
			},
			description: "Street not found",
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
	tags: ["Streets"],
});
