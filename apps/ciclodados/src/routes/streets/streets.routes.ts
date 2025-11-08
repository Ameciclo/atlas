import { createRoute } from "@hono/zod-openapi";
import { 
	streetSearchQuerySchema, 
	streetSearchResponseSchema,
	streetDetailsParamsSchema,
	streetDetailsResponseSchema,
	errorResponseSchema 
} from "../../lib/schemas.js";

export const searchStreetsRoute = createRoute({
	method: "get",
	path: "/streets/search",
	summary: "Search for streets by name",
	description: "Fuzzy search for streets in the PCR streets database",
	request: {
		query: streetSearchQuerySchema,
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: streetSearchResponseSchema,
				},
			},
			description: "List of matching streets",
		},
		400: {
			content: {
				"application/json": {
					schema: errorResponseSchema,
				},
			},
			description: "Invalid query parameters",
		},
	},
	tags: ["Streets"],
});

export const getStreetDetailsRoute = createRoute({
	method: "get",
	path: "/streets/{streetId}",
	summary: "Get street details by ID",
	description: "Get complete street information including geometry",
	request: {
		params: streetDetailsParamsSchema,
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: streetDetailsResponseSchema,
				},
			},
			description: "Street details with geometry",
		},
		404: {
			content: {
				"application/json": {
					schema: errorResponseSchema,
				},
			},
			description: "Street not found",
		},
	},
	tags: ["Streets"],
});

export type SearchStreetsRoute = typeof searchStreetsRoute;
export type GetStreetDetailsRoute = typeof getStreetDetailsRoute;