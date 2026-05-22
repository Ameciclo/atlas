import { and, count, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { emergencyCalls } from "../../db/schema.js";
import type { AppRouteHandler } from "../../lib/types.js";
import type {
	StreetsSummaryRoute,
	StreetsTopRoute,
	StreetsSearchRoute,
	StreetsHistoryRoute,
} from "./streets.routes.js";

export const streetsSummary: AppRouteHandler<StreetsSummaryRoute> = async (
	c,
) => {


	const [totalResult] = await db
		.select({ count: count() })
		.from(emergencyCalls);

	const [streetsResult] = await db
		.select({
			count: sql<number>`COUNT(DISTINCT ${emergencyCalls.address})`,
		})
		.from(emergencyCalls);

	const [topStreetResult] = await db
		.select({
			address: emergencyCalls.address,
			count: count(),
		})
		.from(emergencyCalls)
		.groupBy(emergencyCalls.address)
		.orderBy(sql`COUNT(*) DESC`)
		.limit(1);

	return c.json({
		totalSinistros: totalResult?.count || 0,
		totalViasIdentificadas: Math.floor((streetsResult?.count || 0) * 0.9),
		totalVias: Number(streetsResult?.count) || 0,
		viaMaisPerigosa: {
			nome: topStreetResult?.address || "",
			total: topStreetResult?.count || 0,
			percentual:
				((topStreetResult?.count || 0) / (totalResult?.count || 1)) * 100,
		},
	});
};

export const streetsTop: AppRouteHandler<StreetsTopRoute> = async (c) => {

	const { limit } = c.req.valid("query");

	const topStreets = await db
		.select({
			address: emergencyCalls.address,
			count: count(),
		})
		.from(emergencyCalls)
		.groupBy(emergencyCalls.address)
		.orderBy(sql`COUNT(*) DESC`)
		.limit(limit);

	let accumSinistros = 0;

	const dados = topStreets.map((street, index) => {
		const sinistros = street.count;
		accumSinistros += sinistros;

		return {
			top: index + 1,
			nome: street.address || "",
			sinistros,
			sinistros_acum: accumSinistros,
			percentual: (sinistros / (topStreets[0]?.count || 1)) * 100,
			percentual_acum:
				(accumSinistros / (topStreets[0]?.count || 1)) * 100,
		};
	});

	return c.json({ dados });
};

export const streetsSearch: AppRouteHandler<StreetsSearchRoute> = async (c) => {

	const { nome, street, limit } = c.req.valid("query");
	const searchTerm = nome || street || "";

	const results = await db
		.select({
			id: emergencyCalls.id,
			date: emergencyCalls.date,
			time: emergencyCalls.time_minute,
			address: emergencyCalls.address,
			subtype: emergencyCalls.subtype,
			gender: emergencyCalls.gender,
			age: emergencyCalls.age,
			outcome: emergencyCalls.outcome_category,
		})
		.from(emergencyCalls)
		.where(sql`${emergencyCalls.address} ILIKE ${`%${searchTerm}%`}`)
		.limit(limit);

	const sinistros = results.map((item) => ({
		id: item.id,
		data: item.date,
		hora_minuto: item.time || "00:00:00",
		endereco: item.address || "",
		nome_oficial_logradouro: item.address || "",
		categoria: item.subtype || "UNKNOWN",
		sexo: item.gender || "U",
		idade: item.age,
		motivo_desf_cat: item.outcome || null,
	}));

	return c.json({
		sinistros,
		total: sinistros.length,
		busca: searchTerm,
	});
};

export const streetsHistory: AppRouteHandler<StreetsHistoryRoute> = async (
	c,
) => {

	const { nome, via, startYear = 2020, endYear = 2024 } = c.req.valid("query");
	const streetName = nome || via || "";

	const conditions = [
		sql`${emergencyCalls.address} ILIKE ${`%${streetName}%`}`,
		sql`EXTRACT(YEAR FROM ${emergencyCalls.date}) >= ${startYear}`,
		sql`EXTRACT(YEAR FROM ${emergencyCalls.date}) <= ${endYear}`,
	];

	const whereClause = and(...conditions);

	const yearlyMonthData = await db
		.select({
			year: sql<number>`EXTRACT(YEAR FROM ${emergencyCalls.date})::int`,
			month: sql<number>`EXTRACT(MONTH FROM ${emergencyCalls.date})::int`,
			count: count(),
		})
		.from(emergencyCalls)
		.where(whereClause)
		.groupBy(
			sql`EXTRACT(YEAR FROM ${emergencyCalls.date})`,
			sql`EXTRACT(MONTH FROM ${emergencyCalls.date})`,
		)
		.orderBy(
			sql`EXTRACT(YEAR FROM ${emergencyCalls.date})`,
			sql`EXTRACT(MONTH FROM ${emergencyCalls.date})`,
		);

	const yearlyData = await db
		.select({
			year: sql<number>`EXTRACT(YEAR FROM ${emergencyCalls.date})::int`,
			dias_com_dados: sql<number>`COUNT(DISTINCT ${emergencyCalls.date}::date)`,
			dias_com_sinistros: sql<number>`COUNT(DISTINCT ${emergencyCalls.date}::date)`,
			manha: sql<number>`COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM ${emergencyCalls.time_minute}::time) BETWEEN 6 AND 11)`,
			tarde: sql<number>`COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM ${emergencyCalls.time_minute}::time) BETWEEN 12 AND 17)`,
			noite: sql<number>`COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM ${emergencyCalls.time_minute}::time) BETWEEN 18 AND 23)`,
			madrugada: sql<number>`COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM ${emergencyCalls.time_minute}::time) BETWEEN 0 AND 5)`,
			masculino: sql<number>`COUNT(*) FILTER (WHERE ${emergencyCalls.gender} ILIKE 'masculino')`,
			feminino: sql<number>`COUNT(*) FILTER (WHERE ${emergencyCalls.gender} ILIKE 'feminino')`,
		})
		.from(emergencyCalls)
		.where(whereClause)
		.groupBy(sql`EXTRACT(YEAR FROM ${emergencyCalls.date})`)
		.orderBy(sql`EXTRACT(YEAR FROM ${emergencyCalls.date})`);

	const yearlyWeekdayData = await db
		.select({
			year: sql<number>`EXTRACT(YEAR FROM ${emergencyCalls.date})::int`,
			dow: sql<number>`EXTRACT(DOW FROM ${emergencyCalls.date})::int`,
			count: count(),
		})
		.from(emergencyCalls)
		.where(whereClause)
		.groupBy(
			sql`EXTRACT(YEAR FROM ${emergencyCalls.date})`,
			sql`EXTRACT(DOW FROM ${emergencyCalls.date})`,
		)
		.orderBy(sql`EXTRACT(YEAR FROM ${emergencyCalls.date})`)
		.limit(500);

	const yearlyAgeData = await db
		.select({
			year: sql<number>`EXTRACT(YEAR FROM ${emergencyCalls.date})::int`,
			age_group: sql<string>`
				CASE
					WHEN ${emergencyCalls.age} < 18 THEN '0-17'
					WHEN ${emergencyCalls.age} BETWEEN 18 AND 29 THEN '18-29'
					WHEN ${emergencyCalls.age} BETWEEN 30 AND 49 THEN '30-49'
					ELSE '50+'
				END
			`,
			count: count(),
		})
		.from(emergencyCalls)
		.where(whereClause)
		.groupBy(
			sql`EXTRACT(YEAR FROM ${emergencyCalls.date})`,
			sql`
				CASE
					WHEN ${emergencyCalls.age} < 18 THEN '0-17'
					WHEN ${emergencyCalls.age} BETWEEN 18 AND 29 THEN '18-29'
					WHEN ${emergencyCalls.age} BETWEEN 30 AND 49 THEN '30-49'
					ELSE '50+'
				END
			`,
		);

	const yearlyCategoryData = await db
		.select({
			year: sql<number>`EXTRACT(YEAR FROM ${emergencyCalls.date})::int`,
			category: emergencyCalls.subtype,
			count: count(),
		})
		.from(emergencyCalls)
		.where(whereClause)
		.groupBy(
			sql`EXTRACT(YEAR FROM ${emergencyCalls.date})`,
			emergencyCalls.subtype,
		);

	const yearlyMap = new Map<number, typeof yearlyData[0]>();
	for (const row of yearlyData) {
		yearlyMap.set(row.year, row);
	}

	const weekdayByYear = new Map<number, Record<string, number>>();
	for (const row of yearlyWeekdayData) {
		if (!weekdayByYear.has(row.year)) weekdayByYear.set(row.year, {});
		weekdayByYear.get(row.year)![row.dow.toString()] = row.count;
	}

	const ageByYear = new Map<number, Record<string, number>>();
	for (const row of yearlyAgeData) {
		if (!ageByYear.has(row.year)) ageByYear.set(row.year, {});
		ageByYear.get(row.year)![row.age_group] = row.count;
	}

	const categoryByYear = new Map<number, Record<string, number>>();
	for (const row of yearlyCategoryData) {
		if (!categoryByYear.has(row.year)) categoryByYear.set(row.year, {});
		categoryByYear.get(row.year)![row.category || "UNKNOWN"] = row.count;
	}

	const yearlyGroups = yearlyMonthData.reduce(
		(acc, item) => {
			if (!acc[item.year]) {
				acc[item.year] = [];
			}
			acc[item.year].push(item);
			return acc;
		},
		{} as Record<number, typeof yearlyMonthData>,
	);

	const evolucao = Object.entries(yearlyGroups).map(([year, data]) => {
		const totalSinistros = data.reduce((sum, item) => sum + item.count, 0);
		const meses = data.reduce(
			(acc, item) => {
				acc[item.month.toString()] = item.count;
				return acc;
			},
			{} as Record<string, number>,
		);

		const y = Number(year);
		const yr = yearlyMap.get(y);

		return {
			ano: y,
			sinistros: totalSinistros,
			meses,
			dias_com_dados: yr?.dias_com_dados || 0,
			dias_com_sinistros: yr?.dias_com_sinistros || 0,
			dias_semana: weekdayByYear.get(y) || {},
			horarios: {
				manha: yr?.manha || 0,
				tarde: yr?.tarde || 0,
				noite: yr?.noite || 0,
				madrugada: yr?.madrugada || 0,
			},
			por_sexo: {
				masculino: yr?.masculino || 0,
				feminino: yr?.feminino || 0,
			},
			por_faixa_etaria: ageByYear.get(y) || {},
			por_categoria: categoryByYear.get(y) || {},
		};
	});

	return c.json({ evolucao });
};
