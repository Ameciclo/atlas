import { createRoute, z } from "@hono/zod-openapi";

export const streetStatsRoute = createRoute({
	method: "get",
	path: "/street-stats",
	tags: ["Dashboard"],
	summary: "Estatísticas por logradouro",
	description:
		"Visão completa para um logradouro específico: total, evolução temporal, categorias, infrações, agentes. Aceita ?street_code= e ?limit_violations=",
	request: {
		query: z.object({
			street_code: z.coerce.number().int().openapi({
				description: "Código do logradouro (ex: 123)",
			}),
			limit_violations: z.coerce.number().int().min(1).optional().openapi({
				description: "Limitar para as top N infrações (padrão: todas)",
			}),
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
						street_info: z
							.object({
								street_code: z.number(),
								official_name: z.string(),
								extension_km: z.number(),
								violations_per_km: z.number(),
							})
							.nullable(),
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
						category: z.array(
							z.object({
								category: z.string(),
								count: z.number(),
								percentage: z.number(),
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
								top_violations: z.array(
									z.object({
										law_code: z.string(),
										description: z.string(),
										count: z.number(),
									}),
								),
							}),
						),
						violations: z.array(
							z.object({
								law_code: z.string(),
								description: z.string(),
								count: z.number(),
								percentage: z.number(),
								by_year: z.array(
									z.object({
										year: z.number(),
										count: z.number(),
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
						),
					}),
				},
			},
			description: "Street statistics",
		},
	},
});
