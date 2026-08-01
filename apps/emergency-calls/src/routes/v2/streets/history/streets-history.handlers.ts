import { and, eq, count, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { normalizeCategories } from "../../../../lib/categories.js";
import { db } from "../../../../db/index.js";
import { emergencyCalls, pcrStreets } from "../../../../db/schema.js";
import type { AppRouteHandler } from "../../../../lib/types.js";
import type { StreetsHistoryRoute } from "./streets-history.routes.js";

const AGE_BUCKETS = [
	"0_17_anos",
	"18_29_anos",
	"30_49_anos",
	"50_64_anos",
	"65_mais_anos",
] as const;

function normalizeAge(raw: Record<string, number>): Record<string, number> {
	const result: Record<string, number> = {
		nao_informado: Number(raw.nao_informado) || 0,
	};
	for (const bucket of AGE_BUCKETS) result[bucket] = Number(raw[bucket]) || 0;
	return result;
}

export const streetsHistory: AppRouteHandler<StreetsHistoryRoute> = async (
	c,
) => {
	const { via, desfechos = "todos", startYear, endYear } = c.req.valid("query");
	const streetName = via.trim();

	const [pcrStreet] = await db
		.select({ id: pcrStreets.id, name: pcrStreets.nlogra_conc })
		.from(pcrStreets)
		.where(eq(pcrStreets.nlogra_conc, streetName))
		.limit(1);

	if (!pcrStreet) {
		return c.json({ message: "Street not found" }, HttpStatusCodes.NOT_FOUND);
	}

	const conditions: ReturnType<typeof sql>[] = [
		eq(emergencyCalls.pcr_street_id, pcrStreet.id),
	];

	if (desfechos === "validos") {
		conditions.push(sql`${emergencyCalls.outcome_category} IS NOT NULL`);
	} else if (desfechos === "invalidos") {
		conditions.push(sql`${emergencyCalls.outcome_category} IS NULL`);
	}

	if (startYear)
		conditions.push(
			sql`EXTRACT(YEAR FROM ${emergencyCalls.date}) >= ${startYear}`,
		);
	if (endYear)
		conditions.push(
			sql`EXTRACT(YEAR FROM ${emergencyCalls.date}) <= ${endYear}`,
		);

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
			total: count(),
			dias_com_dados: sql<number>`COUNT(DISTINCT ${emergencyCalls.date}::date)::int`,
			ultimo_dia: sql<string>`MAX(${emergencyCalls.date}::date)::text`,
			masculino: sql<number>`COUNT(*) FILTER (WHERE ${emergencyCalls.gender} ILIKE 'masculino')::int`,
			feminino: sql<number>`COUNT(*) FILTER (WHERE ${emergencyCalls.gender} ILIKE 'feminino')::int`,
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
		.orderBy(sql`EXTRACT(YEAR FROM ${emergencyCalls.date})`);

	const yearlyHourData = await db
		.select({
			year: sql<number>`EXTRACT(YEAR FROM ${emergencyCalls.date})::int`,
			hour: sql<number>`EXTRACT(HOUR FROM ${emergencyCalls.time_minute}::time)::int`,
			count: count(),
		})
		.from(emergencyCalls)
		.where(whereClause)
		.groupBy(
			sql`EXTRACT(YEAR FROM ${emergencyCalls.date})`,
			sql`EXTRACT(HOUR FROM ${emergencyCalls.time_minute}::time)`,
		)
		.orderBy(sql`EXTRACT(YEAR FROM ${emergencyCalls.date})`);

	const yearlyAgeData = await db
		.select({
			year: sql<number>`EXTRACT(YEAR FROM ${emergencyCalls.date})::int`,
			age_group: sql<string>`
				CASE
					WHEN ${emergencyCalls.age} IS NULL THEN 'nao_informado'
					WHEN ${emergencyCalls.age} < 18 THEN '0_17_anos'
					WHEN ${emergencyCalls.age} BETWEEN 18 AND 29 THEN '18_29_anos'
					WHEN ${emergencyCalls.age} BETWEEN 30 AND 49 THEN '30_49_anos'
					WHEN ${emergencyCalls.age} BETWEEN 50 AND 64 THEN '50_64_anos'
					ELSE '65_mais_anos'
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
					WHEN ${emergencyCalls.age} IS NULL THEN 'nao_informado'
					WHEN ${emergencyCalls.age} < 18 THEN '0_17_anos'
					WHEN ${emergencyCalls.age} BETWEEN 18 AND 29 THEN '18_29_anos'
					WHEN ${emergencyCalls.age} BETWEEN 30 AND 49 THEN '30_49_anos'
					WHEN ${emergencyCalls.age} BETWEEN 50 AND 64 THEN '50_64_anos'
					ELSE '65_mais_anos'
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

	const yearlyMap = new Map<number, (typeof yearlyData)[0]>();
	for (const row of yearlyData) {
		yearlyMap.set(row.year, row);
	}

	const weekdayByYear = new Map<number, Record<string, number>>();
	for (const row of yearlyWeekdayData) {
		if (!weekdayByYear.has(row.year)) weekdayByYear.set(row.year, {});
		weekdayByYear.get(row.year)![row.dow.toString()] = row.count;
	}

	const hourByYear = new Map<number, Record<string, number>>();
	for (const row of yearlyHourData) {
		if (!hourByYear.has(row.year)) hourByYear.set(row.year, {});
		hourByYear.get(row.year)![row.hour.toString()] = row.count;
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
			if (!acc[item.year]) acc[item.year] = [];
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

		const rawGender = {
			masculino: yr?.masculino || 0,
			feminino: yr?.feminino || 0,
		};
		const totalGender = rawGender.masculino + rawGender.feminino;
		const naoInformado = totalSinistros - totalGender;
		const porSexo: Record<string, number> = {
			masculino: rawGender.masculino,
			feminino: rawGender.feminino,
			nao_informado: Math.max(0, naoInformado),
		};

		return {
			ano: year,
			sinistros: totalSinistros,
			meses,
			dias_com_dados: yr?.dias_com_dados || 0,
			dias_com_sinistros: yr?.dias_com_dados || 0,
			ultimo_dia: yr?.ultimo_dia || "",
			dias_semana: weekdayByYear.get(y) || {},
			horarios: hourByYear.get(y) || {},
			por_sexo: porSexo,
			por_faixa_etaria: normalizeAge(ageByYear.get(y) || {}),
			por_categoria: normalizeCategories(categoryByYear.get(y) || {}),
		};
	});

	return c.json(
		{
			via: pcrStreet.name,
			filtro_desfechos: desfechos,
			evolucao,
		},
		HttpStatusCodes.OK,
	);
};
