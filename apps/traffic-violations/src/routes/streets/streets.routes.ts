import { createRoute, z } from "@hono/zod-openapi";

const tags = ["Streets"];

export const listStreetsRoute = createRoute({
	method: "get",
	path: "/streets",
	tags,
	summary: "List official streets",
	description: "Get a paginated list of official streets with optional filtering",
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
			neighborhood: z.string().optional().openapi({
				description: "Filter by neighborhood name",
				example: "BOA VIAGEM",
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
								transport_corridor: z.boolean().nullable(),
								perimeter_road: z.boolean().nullable(),
								neighborhood_code: z.number().nullable(),
								neighborhood_name: z.string().nullable(),
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

export const getStreetRoute = createRoute({
	method: "get",
	path: "/streets/{code}",
	tags,
	summary: "Get street by code",
	description: "Get detailed information about a specific street by its code",
	request: {
		params: z.object({
			code: z.coerce.number().openapi({
				description: "Street code",
				example: 6939,
			}),
		}),
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						id: z.number(),
						code: z.number(),
						name_concatenated: z.string(),
						official_name: z.string(),
						short_name: z.string(),
						pavement_code: z.string().nullable(),
						pavement_description: z.string().nullable(),
						transport_corridor: z.boolean().nullable(),
						perimeter_road: z.boolean().nullable(),
						neighborhood_code: z.number().nullable(),
						neighborhood_name: z.string().nullable(),
						created_at: z.string(),
						updated_at: z.string(),
					}),
				},
			},
			description: "Street details",
		},
		404: {
			content: {
				"application/json": {
					schema: z.object({
						error: z.string(),
					}),
				},
			},
			description: "Street not found",
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