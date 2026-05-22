import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { notFoundSchema } from "../../../../lib/constants.js";

const tags = ["Streets History"];

export const streetsHistory = createRoute({
	path: "/streets/history",
	method: "get",
	tags,
	summary: "Get street accident history",
	description: "Get temporal history of accidents for a street by PCR street name",
	request: {
		query: z.object({
			via: z.string().openapi({
				description: "PCR street name (exact match on pcr_streets.nlogra_conc)",
				example: "ROD BR CENTO E UM",
			}),
			desfechos: z
				.enum(["todos", "validos", "invalidos"])
				.optional()
				.default("todos")
				.openapi({
					description: "Outcome filter",
					example: "validos",
				}),
			startYear: z.coerce.number().optional().openapi({
				description: "Start year",
				example: 2020,
			}),
			endYear: z.coerce.number().optional().openapi({
				description: "End year",
				example: 2024,
			}),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				via: z.string(),
				filtro_desfechos: z.string(),
				evolucao: z.array(
					z.object({
						ano: z.string(),
						sinistros: z.number(),
						meses: z.record(z.number()),
						dias_com_dados: z.number(),
						dias_com_sinistros: z.number(),
						ultimo_dia: z.string(),
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
		[HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "Street not found"),
	},
});

export type StreetsHistoryRoute = typeof streetsHistory;
