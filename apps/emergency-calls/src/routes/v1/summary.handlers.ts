import { and, count, eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { emergencyCalls } from "../../db/schema.js";
import type { AppRouteHandler } from "../../lib/types.js";
import type { SummaryRoute } from "./summary.routes.js";

export const summary: AppRouteHandler<SummaryRoute> = async (c) => {
	const { start_year, end_year } = c.req.valid("query");

	const yearCondition = end_year
		? sql`EXTRACT(YEAR FROM ${emergencyCalls.date})::int BETWEEN ${start_year} AND ${end_year}`
		: sql`EXTRACT(YEAR FROM ${emergencyCalls.date})::int >= ${start_year}`;

	const [totalResult] = await db
		.select({ count: count() })
		.from(emergencyCalls)
		.where(yearCondition);

	const totalChamadas = totalResult?.count || 0;

	const [validResult] = await db
		.select({ count: count() })
		.from(emergencyCalls)
		.where(and(yearCondition, sql`${emergencyCalls.outcome_category} IS NOT NULL`));

	const totalDesfechosValidos = validResult?.count || 0;
	const totalDesfechosInvalidos = totalChamadas - totalDesfechosValidos;

	const [topCityResult] = await db
		.select({
			municipio: emergencyCalls.municipality,
			count: count(),
		})
		.from(emergencyCalls)
		.where(yearCondition)
		.groupBy(emergencyCalls.municipality)
		.orderBy(sql`COUNT(*) DESC`)
		.limit(1);

	const categoriesData = await db
		.select({
			categoria: emergencyCalls.subtype,
			count: count(),
		})
		.from(emergencyCalls)
		.where(yearCondition)
		.groupBy(emergencyCalls.subtype)
		.orderBy(sql`COUNT(*) DESC`)
		.limit(10);

	const yearlyData = await db
		.select({
			ano: sql<number>`EXTRACT(YEAR FROM ${emergencyCalls.date})::int`,
			count: count(),
		})
		.from(emergencyCalls)
		.where(yearCondition)
		.groupBy(sql`EXTRACT(YEAR FROM ${emergencyCalls.date})`)
		.orderBy(sql`EXTRACT(YEAR FROM ${emergencyCalls.date})`);

	const evolucaoAnual = yearlyData.map((item) => ({
		ano: item.ano,
		count: item.count,
		projecao: Math.floor(item.count * 1.05),
		ultimaData: `${item.ano}-12-31`,
	}));

	const topCityYearlyData = topCityResult?.municipio
		? await db
				.select({
					ano: sql<number>`EXTRACT(YEAR FROM ${emergencyCalls.date})::int`,
					totalValidas: sql<number>`COUNT(*) FILTER (WHERE ${emergencyCalls.outcome_category} IS NOT NULL)`,
					totalInvalidas: sql<number>`COUNT(*) FILTER (WHERE ${emergencyCalls.outcome_category} IS NULL)`,
					count: count(),
				})
				.from(emergencyCalls)
				.where(and(yearCondition, eq(emergencyCalls.municipality, topCityResult.municipio!)))
				.groupBy(sql`EXTRACT(YEAR FROM ${emergencyCalls.date})`)
				.orderBy(sql`EXTRACT(YEAR FROM ${emergencyCalls.date})`)
		: [];

	const finalizationData = await db
		.select({
			motivo: emergencyCalls.finalization_category,
			count: count(),
		})
		.from(emergencyCalls)
		.where(and(yearCondition, sql`${emergencyCalls.finalization_category} IS NOT NULL`))
		.groupBy(emergencyCalls.finalization_category)
		.orderBy(sql`COUNT(*) DESC`)
		.limit(10);

	const outcomeData = await db
		.select({
			motivo: emergencyCalls.outcome_category,
			count: count(),
		})
		.from(emergencyCalls)
		.where(and(yearCondition, sql`${emergencyCalls.outcome_category} IS NOT NULL`))
		.groupBy(emergencyCalls.outcome_category)
		.orderBy(sql`COUNT(*) DESC`)
		.limit(10);

	const [periodResult] = await db
		.select({
			ultimoMes: sql<string>`TO_CHAR(MAX(${emergencyCalls.date}), 'YYYY.MM')`,
			ultimoDia: sql<string>`MAX(${emergencyCalls.date})::date::text`,
		})
		.from(emergencyCalls)
		.where(yearCondition);

	const [diasResult] = await db
		.select({
			count: sql<number>`COUNT(DISTINCT ${emergencyCalls.date}::date)`,
		})
		.from(emergencyCalls)
		.where(yearCondition);

	return c.json({
		totalChamadas,
		totalDesfechosValidos,
		totalDesfechosInvalidos,
		cidadeMaisViolenta: {
			municipio: topCityResult?.municipio || "",
			totalValidas: topCityResult
				? topCityYearlyData.reduce((sum, d) => sum + Number(d.totalValidas), 0)
				: 0,
			totalInvalidas: topCityResult
				? topCityYearlyData.reduce((sum, d) => sum + Number(d.totalInvalidas), 0)
				: 0,
			total: topCityResult?.count || 0,
			evolucaoAnual: topCityYearlyData.map((d) => ({
				ano: d.ano,
				totalValidas: Number(d.totalValidas),
				totalInvalidas: Number(d.totalInvalidas),
				total: d.count,
			})),
		},
		porCategoria: categoriesData.map((item) => ({
			categoria: item.categoria || "UNKNOWN",
			count: item.count,
		})),
		porMotivoFinalizacao: finalizationData.map((item) => ({
			motivo: item.motivo || "UNKNOWN",
			count: item.count,
		})),
		porMotivoDesfecho: outcomeData.map((item) => ({
			motivo: item.motivo || "UNKNOWN",
			count: item.count,
		})),
		evolucaoAnual,
		periodo: {
			inicio: start_year,
			fim: end_year ?? (periodResult?.ultimoMes ? Number.parseInt(periodResult.ultimoMes.split(".")[0]) : start_year),
			ultimoMes: periodResult?.ultimoMes || "",
			ultimoDia: periodResult?.ultimoDia?.split("T")[0] || "",
			totalDiasComDados: Number(diasResult?.count) || 0,
		},
	});
};
