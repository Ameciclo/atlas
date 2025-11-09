import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const tags = ["V1 Causas Secundárias"];

export const getCausasSecundariasV1 = createRoute({
	path: "/causas-secundarias",
	method: "get",
	tags,
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
