import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const tags = ["V1 Matrix"];

export const getMatrixV1 = createRoute({
	path: "/matrix",
	method: "get",
	tags,
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				matrix: z.array(z.array(z.number())),
				labels: z.object({
					rows: z.array(z.string()),
					columns: z.array(z.string()),
				}),
			}),
			"Análise de matriz de dados de mortes no trânsito",
		),
	},
});