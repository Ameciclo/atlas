import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const tags = ["V1 Causas Secundárias"];

export const getCausasSecundariasV1 = createRoute({
	path: "/causas-secundarias",
	method: "get",
	tags,
	request: {
		query: z.object({
			cityCode: z.coerce.number().optional(),
			municipio: z.coerce.number().optional(),
			startYear: z.coerce.number().optional(),
			anoInicio: z.coerce.number().optional(),
			endYear: z.coerce.number().optional(),
			anoFim: z.coerce.number().optional(),
			locationType: z.enum(["residence", "occurrence"]).optional(),
			tipoLocal: z.enum(["residencia", "ocorrencia"]).optional(),
			transportMode: z.string().optional(),
			modoTransporte: z.string().optional(),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				causas: z.array(
					z.object({
						codigo: z.string(),
						descricao: z.string(),
						total: z.number(),
						percentual: z.number(),
					}),
				),
				total: z.number(),
			}),
			"Análise de causas secundárias de mortes no trânsito",
		),
	},
});
