import { createRoute } from "@hono/zod-openapi";
import { 
	pointAnalysisBodySchema,
	pointAnalysisResponseSchema,
	errorResponseSchema 
} from "../../lib/schemas.js";

export const analyzePointRoute = createRoute({
	method: "post",
	path: "/analyze/point",
	summary: "Analyze area around a geographic point",
	description: "Get comprehensive cycling data for streets and amenities near a point",
	request: {
		body: {
			content: {
				"application/json": {
					schema: pointAnalysisBodySchema,
				},
			},
		},
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: pointAnalysisResponseSchema,
				},
			},
			description: "Comprehensive area analysis",
		},
		400: {
			content: {
				"application/json": {
					schema: errorResponseSchema,
				},
			},
			description: "Invalid coordinates or parameters",
		},
	},
	tags: ["Analysis"],
});

export type AnalyzePointRoute = typeof analyzePointRoute;