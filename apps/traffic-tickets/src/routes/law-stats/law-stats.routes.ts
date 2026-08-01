import { createRoute, z } from "@hono/zod-openapi";

export const lawStatsRoute = createRoute({
	method: "get",
	path: "/law-stats",
	tags: ["Dashboard"],
	summary: "Estatísticas por artigo de lei",
	description:
		"Visão enxuta para um artigo específico: total + evolução temporal por law_code. Aceita ?law=Art. 201, ?law=Art. 181, etc.",
	request: {
		query: z.object({
			law: z.string().openapi({
				description: "Artigo de lei (ex: Art. 201, Art. 181)",
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
						law_code_breakdown: z.array(
							z.object({
								law_code: z.string(),
								description: z.string(),
								count: z.number(),
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
							}),
						),
					}),
				},
			},
			description: "Law statistics",
		},
	},
});
