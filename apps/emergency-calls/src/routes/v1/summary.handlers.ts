import { count, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { db, ensureConnection } from "../../db/index.js";
import { emergencyCalls } from "../../db/schema.js";
import type { AppRouteHandler } from "../../lib/types.js";
import type { SummaryRoute } from "./summary.routes.js";

export const summary: AppRouteHandler<SummaryRoute> = async (c) => {
	await ensureConnection();

	// Get total calls
	const [totalResult] = await db
		.select({ count: count() })
		.from(emergencyCalls);

	// Get valid/invalid outcomes (mock data for now)
	const totalChamadas = totalResult?.count || 0;
	const totalDesfechosValidos = Math.floor(totalChamadas * 0.85);
	const totalDesfechosInvalidos = totalChamadas - totalDesfechosValidos;

	// Get most violent city
	const [topCityResult] = await db
		.select({
			municipio: emergencyCalls.municipality,
			count: count(),
		})
		.from(emergencyCalls)
		.groupBy(emergencyCalls.municipality)
		.orderBy(sql`COUNT(*) DESC`)
		.limit(1);

	// Get categories
	const categoriesData = await db
		.select({
			categoria: emergencyCalls.subtype,
			count: count(),
		})
		.from(emergencyCalls)
		.groupBy(emergencyCalls.subtype)
		.orderBy(sql`COUNT(*) DESC`)
		.limit(10);

	// Get yearly evolution
	const yearlyData = await db
		.select({
			ano: sql<number>`EXTRACT(YEAR FROM ${emergencyCalls.date})::int`,
			count: count(),
		})
		.from(emergencyCalls)
		.groupBy(sql`EXTRACT(YEAR FROM ${emergencyCalls.date})`)
		.orderBy(sql`EXTRACT(YEAR FROM ${emergencyCalls.date})`);

	const evolucaoAnual = yearlyData.map((item) => ({
		ano: item.ano,
		count: item.count,
		projecao: Math.floor(item.count * 1.05), // Mock projection
		ultimaData: `${item.ano}-12-31`,
	}));

	return c.json({
		totalChamadas,
		totalDesfechosValidos,
		totalDesfechosInvalidos,
		cidadeMaisViolenta: {
			municipio: topCityResult?.municipio || "",
			totalValidas: Math.floor((topCityResult?.count || 0) * 0.85),
			totalInvalidas: Math.floor((topCityResult?.count || 0) * 0.15),
			total: topCityResult?.count || 0,
			evolucaoAnual: [], // Would need more complex query
		},
		porCategoria: categoriesData.map((item) => ({
			categoria: item.categoria || "UNKNOWN",
			count: item.count,
		})),
		porMotivoFinalizacao: [], // Mock data
		porMotivoDesfecho: [], // Mock data
		evolucaoAnual,
		periodo: {
			inicio: 2015,
			fim: 2024,
			ultimoMes: "2024.03",
			ultimoDia: "2024-03-15",
			totalDiasComDados: 2850,
		},
	});
};
