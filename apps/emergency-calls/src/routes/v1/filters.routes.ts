import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const tags = ["Emergency Calls Filters"];

export const filters = createRoute({
	path: "/filters",
	method: "get",
	tags,
	summary: "Get filtered emergency calls",
	description: "Get emergency calls with advanced filtering options",
	request: {
		query: z.object({
			cityId: z.coerce.number().optional(),
			municipio: z.string().optional(),
			startYear: z.coerce.number().optional(),
			anoInicio: z.coerce.number().optional(),
			endYear: z.coerce.number().optional(),
			anoFim: z.coerce.number().optional(),
			gender: z.array(z.string()).optional(),
			sexo: z.array(z.string()).optional(),
			ageMin: z.coerce.number().optional(),
			idadeMin: z.coerce.number().optional(),
			ageMax: z.coerce.number().optional(),
			idadeMax: z.coerce.number().optional(),
			category: z.array(z.string()).optional(),
			categoria: z.array(z.string()).optional(),
			subtype: z.array(z.string()).optional(),
			subtipo: z.array(z.string()).optional(),
			startHour: z.coerce.number().optional(),
			horaInicio: z.coerce.number().optional(),
			endHour: z.coerce.number().optional(),
			horaFim: z.coerce.number().optional(),
			finalizationReason: z.array(z.string()).optional(),
			motivoFinalizacao: z.array(z.string()).optional(),
			outcomeReason: z.array(z.string()).optional(),
			motivoDesfecho: z.array(z.string()).optional(),
			includeInvalid: z.coerce.boolean().optional(),
			incluirInvalidos: z.coerce.boolean().optional(),
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
					porFaixaEtaria: z.record(z.number()),
					porMunicipio: z.record(z.number()),
					porCategoria: z.record(z.number()),
					porSubtipo: z.record(z.number()),
					porHora: z.record(z.number()),
				}),
				dados: z.array(
					z.object({
						ano: z.number(),
						mes: z.number(),
						hora: z.number(),
						municipio: z.object({
							nome: z.string(),
						}),
						sexo: z.object({
							codigo: z.string(),
							descricao: z.string(),
						}),
						idade: z.number(),
						faixaEtaria: z.string(),
						categoria: z.object({
							codigo: z.string(),
							descricao: z.string(),
						}),
						subtipo: z.object({
							codigo: z.string(),
							descricao: z.string(),
						}),
						motivoFinalizacao: z.object({
							codigo: z.string(),
							descricao: z.string(),
						}),
						motivoDesfecho: z.object({
							codigo: z.string(),
							descricao: z.string(),
						}),
						total: z.number(),
					}),
				),
			}),
			"Filtered emergency calls",
		),
	},
});

export type FiltersRoute = typeof filters;
