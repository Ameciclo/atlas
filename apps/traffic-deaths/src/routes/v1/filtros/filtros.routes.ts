import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const tags = ["V1 Filtros"];

export const getFiltrosV1 = createRoute({
	path: "/filtros",
	method: "get",
	tags,
	request: {
		query: z.object({
			cityId: z.coerce.number().optional(),
			municipio: z.coerce.number().optional(),
			locationType: z.enum(["residence", "occurrence"]).optional(),
			tipoLocal: z.enum(["residencia", "ocorrencia"]).optional(),
			startYear: z.coerce.number().optional(),
			anoInicio: z.coerce.number().optional(),
			endYear: z.coerce.number().optional(),
			anoFim: z.coerce.number().optional(),
			gender: z.string().optional(),
			sexo: z.string().optional(),
			race: z.string().optional(),
			racacor: z.string().optional(),
			ageMin: z.coerce.number().optional(),
			faixaEtariaMin: z.coerce.number().optional(),
			ageMax: z.coerce.number().optional(),
			faixaEtariaMax: z.coerce.number().optional(),
			transportMode: z.string().optional(),
			modoTransporte: z.string().optional(),
			deathLocation: z.string().optional(),
			localOcorrenciaObito: z.string().optional(),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				filtrosAplicados: z.record(z.any()),
				totalGeral: z.number(),
				resumo: z.object({
					porAno: z.record(z.number()),
					porSexo: z.record(z.number()),
					porRacaCor: z.record(z.number()),
					porFaixaEtaria: z.record(z.number()),
					porMunicipio: z.record(z.number()),
					porModoTransporte: z.record(z.number()),
					porLocalOcorrenciaObito: z.record(z.number()),
				}),
				dados: z.array(z.object({
					ano: z.number(),
					municipio: z.object({
						id: z.number(),
						nome: z.string(),
					}),
					sexo: z.object({
						codigo: z.string(),
						descricao: z.string(),
					}),
					racacor: z.object({
						codigo: z.string(),
						descricao: z.string(),
					}),
					idade: z.number(),
					idadeOriginal: z.number(),
					faixaEtaria: z.string(),
					modoTransporte: z.object({
						codigo: z.string(),
						descricao: z.string(),
					}),
					localOcorrenciaObito: z.object({
						codigo: z.string(),
						descricao: z.string(),
					}),
					causabas: z.string(),
					total: z.number(),
				})),
			}),
			"Endpoint principal com filtros avançados para análise de mortes no trânsito",
		),
	},
});