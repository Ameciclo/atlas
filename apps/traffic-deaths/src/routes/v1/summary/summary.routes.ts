import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const tags = ["V1 Summary"];

const summaryDataSchema = z.object({
	totalSinistrosUltimos10Anos: z.number(),
	totalUltimoAno: z.number(),
	ultimoAno: z.number(),
	crescimentoRelacaoAnoAnterior: z.number(),
	anoMaisViolento: z.object({
		ano: z.number(),
		total: z.number(),
	}),
	dadosPorAno: z.array(
		z.object({
			ano: z.number(),
			total: z.number(),
		}),
	),
});

export const getSummaryV1 = createRoute({
	path: "/summary",
	method: "get",
	tags,
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				porLocalOcorrencia: summaryDataSchema,
				porLocalResidencia: summaryDataSchema,
			}),
			"Resumo estatístico das mortes no trânsito na RMR",
		),
	},
});
