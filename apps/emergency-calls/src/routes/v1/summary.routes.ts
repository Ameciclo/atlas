import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const tags = ["Emergency Calls Summary"];

export const summary = createRoute({
	path: "/summary",
	method: "get",
	tags,
	summary: "Get emergency calls summary",
	description: "Get statistical summary of SAMU emergency calls",
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				totalChamadas: z.number(),
				totalDesfechosValidos: z.number(),
				totalDesfechosInvalidos: z.number(),
				cidadeMaisViolenta: z.object({
					municipio: z.string(),
					totalValidas: z.number(),
					totalInvalidas: z.number(),
					total: z.number(),
					evolucaoAnual: z.array(z.object({
						ano: z.number(),
						totalValidas: z.number(),
						totalInvalidas: z.number(),
						total: z.number(),
					})),
				}),
				porCategoria: z.array(z.object({
					categoria: z.string(),
					count: z.number(),
				})),
				porMotivoFinalizacao: z.array(z.object({
					motivo: z.string(),
					count: z.number(),
				})),
				porMotivoDesfecho: z.array(z.object({
					motivo: z.string(),
					count: z.number(),
				})),
				evolucaoAnual: z.array(z.object({
					ano: z.number(),
					count: z.number(),
					projecao: z.number(),
					ultimaData: z.string(),
				})),
				periodo: z.object({
					inicio: z.number(),
					fim: z.number(),
					ultimoMes: z.string(),
					ultimoDia: z.string(),
					totalDiasComDados: z.number(),
				}),
			}),
			"Emergency calls summary",
		),
	},
});

export type SummaryRoute = typeof summary;