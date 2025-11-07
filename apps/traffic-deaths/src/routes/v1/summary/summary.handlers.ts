import type { AppRouteHandler } from "../../../lib/types.js";
import type { getSummaryV1 } from "./summary.routes.js";

export const getSummaryV1Handler: AppRouteHandler<typeof getSummaryV1> = async (c) => {
	// TODO: Implement actual data fetching from database
	// This is a placeholder implementation
	const mockData = {
		totalSinistrosUltimos10Anos: 1234,
		totalUltimoAno: 123,
		ultimoAno: 2022,
		crescimentoRelacaoAnoAnterior: 5.2,
		anoMaisViolento: { ano: 2019, total: 150 },
		dadosPorAno: [
			{ ano: 2013, total: 120 },
			{ ano: 2014, total: 125 },
			{ ano: 2015, total: 130 },
		],
	};

	return c.json({
		porLocalOcorrencia: mockData,
		porLocalResidencia: mockData,
	});
};