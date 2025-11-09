import { and, eq, gte, lte, count, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { db, ensureConnection } from "../../db/index.js";
import { emergencyCalls } from "../../db/schema.js";
import type { AppRouteHandler } from "../../lib/types.js";
import type { FiltersRoute } from "./filters.routes.js";

export const filters: AppRouteHandler<FiltersRoute> = async (c) => {
	await ensureConnection();
	const query = c.req.valid("query");

	// Build conditions
	const conditions = [];

	if (query.cityId || query.municipio) {
		// Would need city mapping
	}

	if (query.startYear || query.anoInicio) {
		const year = query.startYear || query.anoInicio;
		conditions.push(sql`EXTRACT(YEAR FROM ${emergencyCalls.date}) >= ${year}`);
	}

	if (query.endYear || query.anoFim) {
		const year = query.endYear || query.anoFim;
		conditions.push(sql`EXTRACT(YEAR FROM ${emergencyCalls.date}) <= ${year}`);
	}

	if (query.gender || query.sexo) {
		const genders = query.gender || query.sexo;
		if (genders && genders.length > 0) {
			conditions.push(sql`${emergencyCalls.gender} = ANY(${genders})`);
		}
	}

	if (query.ageMin || query.idadeMin) {
		const age = query.ageMin || query.idadeMin;
		if (age !== undefined) {
			conditions.push(gte(emergencyCalls.age, age));
		}
	}

	if (query.ageMax || query.idadeMax) {
		const age = query.ageMax || query.idadeMax;
		if (age !== undefined) {
			conditions.push(lte(emergencyCalls.age, age));
		}
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Get total
	const [totalResult] = await db
		.select({ count: count() })
		.from(emergencyCalls)
		.where(whereClause);

	// Get summary data
	const yearlyData = await db
		.select({
			year: sql<string>`EXTRACT(YEAR FROM ${emergencyCalls.date})::text`,
			count: count(),
		})
		.from(emergencyCalls)
		.where(whereClause)
		.groupBy(sql`EXTRACT(YEAR FROM ${emergencyCalls.date})`)
		.orderBy(sql`EXTRACT(YEAR FROM ${emergencyCalls.date})`);

	const genderData = await db
		.select({
			gender: emergencyCalls.gender,
			count: count(),
		})
		.from(emergencyCalls)
		.where(whereClause)
		.groupBy(emergencyCalls.gender);

	// Get sample data
	const dados = await db
		.select({
			date: emergencyCalls.date,
			time: emergencyCalls.time_minute,
			municipality: emergencyCalls.municipality,
			gender: emergencyCalls.gender,
			age: emergencyCalls.age,
			subtype: emergencyCalls.subtype,
			outcome: emergencyCalls.outcome_category,
		})
		.from(emergencyCalls)
		.where(whereClause)
		.limit(100);

	const porAno = yearlyData.reduce(
		(acc, item) => {
			acc[item.year] = item.count;
			return acc;
		},
		{} as Record<string, number>,
	);

	const porSexo = genderData.reduce(
		(acc, item) => {
			if (item.gender) {
				const desc = item.gender === "M" ? "Masculino" : "Feminino";
				acc[desc] = item.count;
			}
			return acc;
		},
		{} as Record<string, number>,
	);

	const formattedDados = dados.map((item) => ({
		ano: new Date(item.date).getFullYear(),
		mes: new Date(item.date).getMonth() + 1,
		hora: item.time ? parseInt(item.time.split(":")[0]) : 0,
		municipio: { nome: item.municipality || "UNKNOWN" },
		sexo: {
			codigo: item.gender || "U",
			descricao:
				item.gender === "M"
					? "Masculino"
					: item.gender === "F"
						? "Feminino"
						: "Não informado",
		},
		idade: item.age || 0,
		faixaEtaria: item.age
			? item.age < 18
				? "0-17"
				: item.age < 30
					? "18-29"
					: item.age < 50
						? "30-49"
						: "50+"
			: "unknown",
		categoria: {
			codigo: item.subtype || "UNKNOWN",
			descricao: item.subtype || "Não informado",
		},
		subtipo: {
			codigo: item.subtype || "UNKNOWN",
			descricao: item.subtype || "Não informado",
		},
		motivoFinalizacao: {
			codigo: item.outcome || "UNKNOWN",
			descricao: item.outcome || "Não informado",
		},
		motivoDesfecho: {
			codigo: item.outcome || "UNKNOWN",
			descricao: item.outcome || "Não informado",
		},
		total: 1,
	}));

	return c.json({
		filtrosAplicados: query,
		totalGeral: totalResult?.count || 0,
		resumo: {
			porAno,
			porSexo,
			porFaixaEtaria: {},
			porMunicipio: {},
			porCategoria: {},
			porSubtipo: {},
			porHora: {},
		},
		dados: formattedDados,
	});
};
