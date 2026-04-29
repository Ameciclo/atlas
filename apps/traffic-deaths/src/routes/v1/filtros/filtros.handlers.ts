import type { AppRouteHandler } from "../../../lib/types.js";
import type { getFiltrosV1 } from "./filtros.routes.js";

export const getFiltrosV1Handler: AppRouteHandler<typeof getFiltrosV1> = async (
	c,
) => {
	const query = c.req.valid("query");

	// Normalize parameters (support both English and Portuguese)
	const filters = {
		tipoLocal:
			query.tipoLocal ||
			(query.locationType === "residence" ? "residencia" : "ocorrencia"),
		anoInicio: query.anoInicio || query.startYear,
		modoTransporte:
			query.modoTransporte || query.transportMode
				? [query.modoTransporte || query.transportMode]
				: undefined,
	};

	// TODO: Implement actual data fetching from database
	return c.json({
		filtrosAplicados: filters,
		totalGeral: 456,
		resumo: {
			porAno: { "2013": 40, "2014": 45, "2015": 50 },
			porSexo: { Masculino: 400, Feminino: 56 },
			porRacaCor: { Branca: 100, Preta: 50, Parda: 300 },
			porFaixaEtaria: { "20 a 29 anos": 150, "30 a 39 anos": 120 },
			porMunicipio: { Recife: 200, Olinda: 80 },
			porModoTransporte: { Motociclista: 456 },
			porLocalOcorrenciaObito: { "Via pública": 300, Hospital: 156 },
		},
		dados: [
			{
				ano: 2022,
				municipio: { id: 2611606, nome: "Recife" },
				sexo: { codigo: "1", descricao: "Masculino" },
				racacor: { codigo: "4", descricao: "Parda" },
				idade: 25,
				idadeOriginal: 425,
				faixaEtaria: "20 a 29 anos",
				modoTransporte: { codigo: "V2", descricao: "Motociclista" },
				localOcorrenciaObito: { codigo: "4", descricao: "Via pública" },
				causabas: "V299",
				total: 1,
			},
		],
	});
};
