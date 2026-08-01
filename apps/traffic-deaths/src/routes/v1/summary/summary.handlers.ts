import { count, inArray } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { trafficDeaths } from "../../../db/schema.js";
import { RMR_6_DIGIT_CODES } from "../../../lib/rmr.js";
import type { AppRouteHandler } from "../../../lib/types.js";
import type { getSummaryV1 } from "./summary.routes.js";

function buildSummary(yearlyDeaths: { year: number | null; total: number }[]) {
	const maxYear = yearlyDeaths.reduce(
		(max, d) => Math.max(max, d.year ?? 0),
		0,
	);
	const latestYearData = yearlyDeaths.find((d) => d.year === maxYear);
	const previousYearData = yearlyDeaths.find((d) => d.year === maxYear - 1);

	const totalUltimoAno = latestYearData?.total ?? 0;
	const previousTotal = previousYearData?.total ?? 0;
	const crescimento =
		previousTotal > 0
			? Number.parseFloat(
					(((totalUltimoAno - previousTotal) / previousTotal) * 100).toFixed(2),
				)
			: 0;

	const mostViolent = yearlyDeaths.reduce(
		(max, curr) => (curr.total > max.total ? curr : max),
		yearlyDeaths[0] ?? { year: maxYear, total: 0 },
	);

	const totalGeral = yearlyDeaths.reduce((sum, d) => sum + d.total, 0);

	return {
		totalSinistrosUltimos10Anos: totalGeral,
		totalUltimoAno,
		ultimoAno: maxYear,
		crescimentoRelacaoAnoAnterior: crescimento,
		anoMaisViolento: {
			ano: mostViolent.year ?? maxYear,
			total: mostViolent.total,
		},
		dadosPorAno: yearlyDeaths.map((d) => ({
			ano: d.year ?? 0,
			total: d.total,
		})),
	};
}

export const getSummaryV1Handler: AppRouteHandler<typeof getSummaryV1> = async (
	c,
) => {
	const [ocorrenciaYearly, residenciaYearly] = await Promise.all([
		db
			.select({
				year: trafficDeaths.data_year,
				total: count(),
			})
			.from(trafficDeaths)
			.where(inArray(trafficDeaths.codmunocor, RMR_6_DIGIT_CODES))
			.groupBy(trafficDeaths.data_year)
			.orderBy(trafficDeaths.data_year),
		db
			.select({
				year: trafficDeaths.data_year,
				total: count(),
			})
			.from(trafficDeaths)
			.where(inArray(trafficDeaths.codmunres, RMR_6_DIGIT_CODES))
			.groupBy(trafficDeaths.data_year)
			.orderBy(trafficDeaths.data_year),
	]);

	return c.json({
		porLocalOcorrencia: buildSummary(ocorrenciaYearly),
		porLocalResidencia: buildSummary(residenciaYearly),
	});
};
