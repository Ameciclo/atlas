import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const tags = ["V1 Matrix"];

export const getMatrixV1 = createRoute({
	path: "/matrix",
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
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				matrix: z.array(z.array(z.number())),
				labels: z.object({
					rows: z.array(z.string()),
					columns: z.array(z.string()),
				}),
			}),
			"Matriz de colisão: modo de transporte da vítima × modo de transporte da contraparte",
		),
	},
});
