import { createRoute, z } from "@hono/zod-openapi";

const StreetSchema = z.object({
	clogra_codi: z.number(),
	nlogra_conc: z.string(),
	nlgpav_ofic: z.string(),
	nlgpav_resu: z.string(),
	indpav: z.string().nullable(),
	db2gse_sde: z.number().nullable(),
});

const StreetWithGeometrySchema = StreetSchema.extend({
	geometry: z.string(),
});

const UniqueNameSchema = z.object({
	nlogra_conc: z.string(),
	nlgpav_ofic: z.string(),
	nlgpav_resu: z.string(),
});

export const getStreetsByNameRoute = createRoute({
	method: "get",
	path: "/streets/name/{name}",
	tags: ["Streets"],
	summary: "Get streets by exact name",
	request: {
		params: z.object({
			name: z.string().openapi({ example: "RUA CEDRO" }),
		}),
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.array(StreetSchema),
				},
			},
			description: "List of streets with exact name match",
		},
	},
});

export const searchStreetsRoute = createRoute({
	method: "get",
	path: "/streets/search",
	tags: ["Streets"],
	summary: "Search streets by partial name",
	request: {
		query: z.object({
			query: z.string().openapi({ example: "cedro" }),
		}),
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.array(StreetSchema),
				},
			},
			description: "List of streets matching search query",
		},
		400: {
			content: {
				"application/json": {
					schema: z.object({ error: z.string() }),
				},
			},
			description: "Bad request - query parameter required",
		},
	},
});

export const getStreetByCodeRoute = createRoute({
	method: "get",
	path: "/streets/code/{code}",
	tags: ["Streets"],
	summary: "Get street by CLOGRACODI",
	request: {
		params: z.object({
			code: z.string().openapi({ example: "15989" }),
		}),
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.array(StreetWithGeometrySchema),
				},
			},
			description: "Street segments with geometry",
		},
		400: {
			content: {
				"application/json": {
					schema: z.object({ error: z.string() }),
				},
			},
			description: "Bad request - code parameter required",
		},
		404: {
			content: {
				"application/json": {
					schema: z.object({ error: z.string() }),
				},
			},
			description: "Street not found",
		},
	},
});

export const getUniqueStreetNamesRoute = createRoute({
	method: "get",
	path: "/streets/names",
	tags: ["Streets"],
	summary: "Get unique street names",
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.array(UniqueNameSchema),
				},
			},
			description: "List of unique street names",
		},
	},
});