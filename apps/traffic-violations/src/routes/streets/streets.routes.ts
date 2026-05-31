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

export const streetsRankingRoute = createRoute({
	method: "get",
	path: "/streets/ranking",
	tags,
	summary: "Get streets ranking by violations",
	description: "Get ranking of streets with most violations",
	request: {
		query: z.object({
			start_date: z.string().optional().openapi({
				description: "Start date (YYYY-MM-DD)",
				example: "2023-01-01",
			}),
			end_date: z.string().optional().openapi({
				description: "End date (YYYY-MM-DD)",
				example: "2023-12-31",
			}),
			violation_type_id: z.coerce.number().optional().openapi({
				description: "Filter by violation type ID",
				example: 5,
			}),
			limit: z.coerce.number().min(1).max(100).default(50).openapi({
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
						streets: z.array(
							z.object({
								street_code: z.number(),
								official_name: z.string(),
								short_name: z.string(),
								total_violations: z.number(),
								ranking: z.number(),
								violations_per_km: z.number(),
							}),
						),
					}),
				},
			},
			description: "Streets ranking",
		},
	},
});

export const streetSummaryRoute = createRoute({
	method: "get",
	path: "/streets/{street_code}/summary",
	tags,
	summary: "Get street violations summary",
	description: "Get summary of violations for a specific street",
	request: {
		params: z.object({
			street_code: z.coerce.number().openapi({
				description: "Street code",
				example: 1025,
			}),
		}),
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						street: z.object({
							code: z.number(),
							official_name: z.string(),
						}),
						violations_summary: z.object({
							total_violations: z.number(),
							violations_per_year: z.record(z.number()),
							top_violation_types: z.array(
								z.object({
									type_id: z.number(),
									description: z.string(),
									count: z.number(),
								}),
							),
						}),
					}),
				},
			},
			description: "Street violations summary",
		},
	},
});

export const streetViolationsRoute = createRoute({
	method: "get",
	path: "/streets/{street_code}/violations",
	tags,
	summary: "Get street violations",
	description: "Get violations for a specific street",
	request: {
		params: z.object({
			street_code: z.coerce.number().openapi({
				description: "Street code",
				example: 1025,
			}),
		}),
		query: z.object({
			start_date: z.string().optional().openapi({
				description: "Start date (YYYY-MM-DD)",
				example: "2023-01-01",
			}),
			end_date: z.string().optional().openapi({
				description: "End date (YYYY-MM-DD)",
				example: "2023-12-31",
			}),
			violation_type_id: z.coerce.number().optional().openapi({
				description: "Filter by violation type ID",
				example: 5,
			}),
			limit: z.coerce.number().min(1).max(1000).default(100).openapi({
				description: "Number of results",
				example: 100,
			}),
			offset: z.coerce.number().min(0).default(0).openapi({
				description: "Offset for pagination",
				example: 0,
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
								date: z.string(),
								time: z.string().nullable(),
								violation_type_id: z.number(),
								violation_description: z.string(),
								agent_id: z.number(),
								location_id: z.number().nullable(),
								location_description: z.string().nullable(),
							}),
						),
						pagination: z.object({
							limit: z.number(),
							offset: z.number(),
							total: z.number(),
						}),
					}),
				},
			},
			description: "Street violations",
		},
	},
});

export const neighborhoodsRoute = createRoute({
	method: "get",
	path: "/streets/neighborhoods",
	tags,
	summary: "Get violations by neighborhood",
	description: "Get violations grouped by neighborhood",
	request: {
		query: z.object({
			start_date: z.string().optional().openapi({
				description: "Start date (YYYY-MM-DD)",
				example: "2023-01-01",
			}),
			end_date: z.string().optional().openapi({
				description: "End date (YYYY-MM-DD)",
				example: "2023-12-31",
			}),
			limit: z.coerce.number().min(1).max(100).default(50).openapi({
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
						neighborhoods: z.array(
							z.object({
								neighborhood_code: z.number().nullable(),
								neighborhood_name: z.string(),
								total_violations: z.number(),
								total_streets: z.number(),
								violations_per_street: z.number(),
								ranking: z.number(),
							}),
						),
					}),
				},
			},
			description: "Neighborhoods violations",
		},
	},
});

export const streetsGeoJSONRoute = createRoute({
	method: "get",
	path: "/streets/geojson",
	tags,
	summary: "Streets GeoJSON with violation counts",
	description:
		"Retorna ruas com contagem de infrações como FeatureCollection GeoJSON. Uma Feature por rua, com geometria MultiLineString e properties com dados agregados.",
	request: {
		query: z.object({
			violation_codes: z.string().optional().openapi({
				description:
					"Comma-separated violation codes (e.g. 7455,6050,5541). Alternative to 'category'.",
				example: "7455,6050",
			}),
			category: z.string().optional().openapi({
				description:
					"Predefined category filter (e.g. 'Segurança viária', 'Pedestres'). Resolves to violation_codes internally.",
				example: "Pedestres",
			}),
			agent_category: z
				.enum(["all", "eletronico", "manual"])
				.default("all")
				.optional()
				.openapi({
					description:
						"Filter by agent category: eletronico (3,4,5,9) or manual (0,1,2,6,7,8)",
					example: "eletronico",
				}),
			start_date: z.string().date().optional().openapi({
				description: "Start date (YYYY-MM-DD)",
				example: "2023-01-01",
			}),
			end_date: z.string().date().optional().openapi({
				description: "End date (YYYY-MM-DD)",
				example: "2023-12-31",
			}),
			limit: z.coerce
				.number()
				.int()
				.min(1)
				.max(100)
				.default(50)
				.optional()
				.openapi({
					description: "Number of streets to return",
					example: 50,
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
								}),
							}),
						),
					}),
				},
			},
			description: "Streets GeoJSON with violation counts",
		},
	},
});
