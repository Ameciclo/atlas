import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const tags = ["V1 Cities"];

export const getCitiesByYearV1 = createRoute({
	path: "/cities-by-year",
	method: "get",
	tags,
	request: {
		query: z.object({
			tipoLocal: z
				.enum(["ocorrencia", "residencia"])
				.default("ocorrencia")
				.optional(),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				tipo: z.string(),
				anos: z.array(z.number()),
				cidades: z.array(
					z
						.object({
							id: z.number(),
							nome: z.string(),
							total: z.number(),
						})
						.catchall(z.union([z.number(), z.string()])),
				),
			}),
			"Dados de mortes por cidade da RMR divididos por ano",
		),
	},
});
