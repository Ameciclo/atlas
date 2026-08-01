import { createRoute, z } from "@hono/zod-openapi";

// ============================================================================
// 1. Overview
// ============================================================================

export const overviewRoute = createRoute({
	method: "get",
	path: "/overview",
	tags: ["Dashboard"],
	summary: "Visão geral da base",
	description:
		"SSR único: stats + evolução + breakdowns. Filtros: ?category=, ?law=, ?street_code=",
	request: {
		query: z.object({
			category: z.string().optional(),
			law: z.string().optional(),
			street_code: z.coerce.number().int().optional(),
			top_violations_limit: z.coerce
				.number()
				.int()
				.min(1)
				.max(20)
				.default(5)
				.optional(),
		}),
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						total_violations: z.number(),
						period_start: z.string().nullable(),
						period_end: z.string().nullable(),
						violation_types_count: z.number(),
						law_codes_count: z.number(),
						streets_count: z.number(),
						evolution: z.object({
							by_year: z.array(
								z.object({ year: z.number(), count: z.number() }),
							),
							by_month: z.array(
								z.object({
									year: z.number(),
									month: z.number(),
									count: z.number(),
								}),
							),
							by_weekday: z.array(
								z.object({ year: z.number(), counts: z.array(z.number()) }),
							),
							by_hour: z.array(
								z.object({ year: z.number(), counts: z.array(z.number()) }),
							),
						}),
						category: z.array(
							z.object({
								category: z.string(),
								count: z.number(),
								percentage: z.number(),
								law_codes_count: z.number(),
								top_violations: z.array(
									z.object({
										law_code: z.string(),
										description: z.string(),
										count: z.number(),
									}),
								),
								by_year: z.array(
									z.object({
										year: z.number(),
										count: z.number(),
										percentage: z.number(),
										top_violations: z.array(
											z.object({
												law_code: z.string(),
												description: z.string(),
												count: z.number(),
											}),
										),
									}),
								),
								by_month: z.array(
									z.object({
										year: z.number(),
										month: z.number(),
										count: z.number(),
									}),
								),
								by_weekday: z.array(
									z.object({
										year: z.number(),
										counts: z.array(z.number()),
									}),
								),
								by_hour: z.array(
									z.object({
										year: z.number(),
										counts: z.array(z.number()),
									}),
								),
							}),
						),
						agents: z.array(
							z.object({
								agent_id: z.number(),
								description: z.string(),
								count: z.number(),
								percentage: z.number(),
								category: z.enum(["eletronico", "manual"]),
								top_violations: z.array(
									z.object({
										law_code: z.string(),
										description: z.string(),
										count: z.number(),
									}),
								),
								by_year: z.array(
									z.object({
										year: z.number(),
										count: z.number(),
										percentage: z.number(),
										top_violations: z.array(
											z.object({
												law_code: z.string(),
												description: z.string(),
												count: z.number(),
											}),
										),
									}),
								),
							}),
						),
						law_codes: z
							.array(
								z.object({
									law_code: z.string(),
									description: z.string(),
									count: z.number(),
								}),
							)
							.optional(),
						street_info: z
							.object({
								street_code: z.number(),
								official_name: z.string(),
								extension_km: z.number(),
								violations_per_km: z.number(),
							})
							.optional(),
					}),
				},
			},
			description: "Dashboard overview",
		},
	},
});

// ============================================================================
// 2. Violation Codes Dictionary
// ============================================================================

export const violationCodesRoute = createRoute({
	method: "get",
	path: "/violation-codes",
	tags: ["Dashboard"],
	summary: "Dicionário de códigos de infração",
	description:
		"Lista todos os códigos de infração com descrições para o frontend montar categorias",
	request: {
		query: z.object({
			start_date: z.string().date().optional().openapi({
				description: "Start date (YYYY-MM-DD)",
			}),
			end_date: z.string().date().optional().openapi({
				description: "End date (YYYY-MM-DD)",
			}),
			category: z.string().optional().openapi({
				description: "Filter by violation category",
			}),
			street_code: z.coerce.number().int().optional().openapi({
				description: "Filter by street code",
			}),
			include_by_year: z.coerce.boolean().optional().openapi({
				description: "Include per-year breakdown in each code",
			}),
		}),
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						codes: z.array(
							z.object({
								law_code: z.string(),
								description: z.string(),
								category: z.string(),
								count: z.number(),
								by_year: z.record(z.string(), z.number()).optional(),
							}),
						),
					}),
				},
			},
			description: "Violation codes dictionary",
		},
	},
});
