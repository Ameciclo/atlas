import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const tags = ["Cities"];

export const cities = createRoute({
	path: "/cities",
	method: "get",
	tags,
	summary: "Get cities with emergency calls data",
	description: "List cities with SAMU data and detailed history",
	request: {
		query: z.object({
			start_year: z.coerce.number().int().optional().default(2020).openapi({
				description: "Start year (default: 2020)",
				example: 2020,
			}),
			end_year: z.coerce.number().int().optional().openapi({
				description: "End year (optional)",
				example: 2024,
			}),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				cidades: z.array(
					z.object({
						municipio_samu: z.string(),
						count: z.number(),
						name: z.string(),
						rmr: z.boolean(),
						ranking: z.number(),
						display_name: z.string(),
						historico_anual: z.array(
							z.object({
								ano: z.number(),
								total_chamados: z.number(),
								total: z.number(),
								validos: z.object({
									total: z.number(),
									atendimento_concluido: z.number(),
									removido_particulares: z.number(),
									removido_bombeiros: z.number(),
									obito_local: z.number(),
								}),
								invalidos: z.number(),
								por_sexo: z.record(z.number()),
								por_faixa_etaria: z.record(z.number()),
								por_categoria: z.record(z.number()),
							}),
						),
					}),
				),
			}),
			"Cities with emergency calls data",
		),
	},
});

export type CitiesRoute = typeof cities;
