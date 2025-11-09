import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const tags = ["Streets Analysis"];

export const streetsSummary = createRoute({
	path: "/streets/summary",
	method: "get",
	tags,
	summary: "Get streets summary",
	description: "Get general summary of streets with accidents",
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				totalSinistros: z.number(),
				totalViasIdentificadas: z.number(),
				totalVias: z.number(),
				extensaoTotalKm: z.number(),
				extensaoMediaKm: z.number(),
				viaMaisPerigosa: z.object({
					nome: z.string(),
					total: z.number(),
					percentual: z.number(),
					extensao: z.number(),
				}),
			}),
			"Streets summary",
		),
	},
});

export const streetsTop = createRoute({
	path: "/streets/top",
	method: "get",
	tags,
	summary: "Get top dangerous streets",
	description: "Get ranking of most dangerous streets",
	request: {
		query: z.object({
			limit: z.coerce.number().optional().default(10),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				dados: z.array(
					z.object({
						top: z.number(),
						sinistros: z.number(),
						sinistros_acum: z.number(),
						km: z.number(),
						km_acum: z.number(),
						sinistros_por_km: z.number(),
						sinistros_por_km_acum: z.number(),
						percentual: z.number(),
						percentual_acum: z.number(),
					}),
				),
			}),
			"Top dangerous streets",
		),
	},
});

export const streetsSearch = createRoute({
	path: "/streets/search",
	method: "get",
	tags,
	summary: "Search accidents by street name",
	description: "Search for accidents by street name",
	request: {
		query: z.object({
			nome: z.string().openapi({
				description: "Street name to search",
				example: "Boa Viagem",
			}),
			limit: z.coerce.number().optional().default(100),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				sinistros: z.array(
					z.object({
						id: z.number(),
						data: z.string(),
						hora_minuto: z.string(),
						endereco: z.string(),
						nome_oficial_logradouro: z.string(),
						categoria: z.string(),
						sexo: z.string(),
						idade: z.number().nullable(),
					}),
				),
				total: z.number(),
				busca: z.string(),
			}),
			"Street search results",
		),
	},
});

export const streetsHistory = createRoute({
	path: "/streets/history",
	method: "get",
	tags,
	summary: "Get street accident history",
	description: "Get temporal history of accidents for a street",
	request: {
		query: z.object({
			nome: z.string().openapi({
				description: "Street name",
				example: "Avenida Boa Viagem",
			}),
			startYear: z.coerce.number().optional(),
			endYear: z.coerce.number().optional(),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				evolucao: z.array(
					z.object({
						ano: z.number(),
						sinistros: z.number(),
						meses: z.record(z.number()),
						dias_com_dados: z.number(),
						dias_com_sinistros: z.number(),
						dias_semana: z.record(z.number()),
						horarios: z.record(z.number()),
						por_sexo: z.record(z.number()),
						por_faixa_etaria: z.record(z.number()),
						por_categoria: z.record(z.number()),
					}),
				),
			}),
			"Street accident history",
		),
	},
});

export type StreetsSummaryRoute = typeof streetsSummary;
export type StreetsTopRoute = typeof streetsTop;
export type StreetsSearchRoute = typeof streetsSearch;
export type StreetsHistoryRoute = typeof streetsHistory;
