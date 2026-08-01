import { and, count, eq, sql } from "drizzle-orm";
import { normalizeCategories } from "../../lib/categories.js";
import { db } from "../../db/index.js";
import { emergencyCalls } from "../../db/schema.js";
import type { AppRouteHandler } from "../../lib/types.js";
import type { CitiesRoute } from "./cities.routes.js";

const RMR_CITIES = new Set([
	"RECIFE",
	"OLINDA",
	"JABOATAO DOS GUARARAPES",
	"PAULISTA",
	"CAMARAGIBE",
	"SAO LOURENCO DA MATA",
	"MORENO",
	"ABREU E LIMA",
	"IGARASSU",
	"ILHA DE ITAMARACA",
	"ITAPISSUMA",
	"CABO DE SANTO AGOSTINHO",
	"IPOJUCA",
	"ARACOIABA",
]);

const DISPLAY_NAME_MAP: Record<string, string> = {
	RECIFE: "Recife",
	OLINDA: "Olinda",
	"JABOATAO DOS GUARARAPES": "Jaboatão dos Guararapes",
	PAULISTA: "Paulista",
	CAMARAGIBE: "Camaragibe",
	"SAO LOURENCO DA MATA": "São Lourenço da Mata",
	MORENO: "Moreno",
	"ABREU E LIMA": "Abreu e Lima",
	IGARASSU: "Igarassu",
	"ILHA DE ITAMARACA": "Ilha de Itamaracá",
	ITAPISSUMA: "Itapissuma",
	"CABO DE SANTO AGOSTINHO": "Cabo de Santo Agostinho",
	IPOJUCA: "Ipojuca",
	GOIANA: "Goiana",
	ARACOIABA: "Araçoiaba",
	"VITORIA DE SANTO ANTAO": "Vitória de Santo Antão",
	PALMARES: "Palmares",
	CARPINA: "Carpina",
	SURUBIM: "Surubim",
	LIMOEIRO: "Limoeiro",
	ESCADA: "Escada",
	TIMBAUBA: "Timbaúba",
	PAUDALHO: "Paudalho",
	POMBOS: "Pombos",
	"BOM JARDIM": "Bom Jardim",
	ALIANCA: "Aliança",
	CONDADO: "Condado",
	TAMANDARE: "Tamandaré",
	BARREIROS: "Barreiros",
	SIRINHAEM: "Sirinhaém",
	RIBEIRAO: "Ribeirão",
	"GLORIA DO GOITA": "Glória do Goitá",
	"NAZARE DA MATA": "Nazaré da Mata",
	ITAMBE: "Itambé",
	"CHA GRANDE": "Chã Grande",
	MACAPARANA: "Macaparana",
	"AGUA PRETA": "Água Preta",
	"FEIRA NOVA": "Feira Nova",
	"SAO JOSE DA COROA GRANDE": "São José da Coroa Grande",
	PASSIRA: "Passira",
	AMARAJI: "Amaraji",
	VICENCIA: "Vicência",
	"RIO FORMOSO": "Rio Formoso",
	"CHA DE ALEGRIA": "Chã de Alegria",
	OROBO: "Orobó",
	"LAGOA DO CARRO": "Lagoa do Carro",
	"LAGOA DO ITAENGA": "Lagoa do Itaenga",
	CATENDE: "Catende",
	CASINHAS: "Casinhas",
	PRIMAVERA: "Primavera",
	GAMELEIRA: "Gameleira",
	"SAO VICENTE FERRER": "São Vicente Férrer",
	"JOAO ALFREDO": "João Alfredo",
	"LAGOA DOS GATOS": "Lagoa dos Gatos",
	XEXEU: "Xexéu",
	"BUENOS AIRES": "Buenos Aires",
	"BELEM DE MARIA": "Belém de Maria",
	JAQUEIRA: "Jaqueira",
	CORTES: "Cortês",
	QUIPAPA: "Quipapá",
	CUMARU: "Cumaru",
	TRACUNHAEM: "Tracunhaém",
	"FERNANDO DE NORONHA": "Fernando de Noronha",
	CAMUTANGA: "Camutanga",
	"SAO BENEDITO DO SUL": "São Benedito do Sul",
	"JOAQUIM NABUCO": "Joaquim Nabuco",
	"VERTENTE DO LERIO": "Vertente do Lério",
	ITAQUITINGA: "Itaquitinga",
	FERREIROS: "Ferreiros",
	MACHADOS: "Machados",
	MARAIAL: "Maraial",
	SALGADINHO: "Salgadinho",
};

function displayName(dbName: string): string {
	return DISPLAY_NAME_MAP[dbName] || dbName;
}

const OUTCOME_VALIDOS_MAP: Record<string, string> = {
	"Atendimento Concluído com Êxito": "atendimento_concluido",
	"Atendimento Concluido com Exito": "atendimento_concluido",
	"Recusa de Remoção": "atendimento_concluido",
	"Recusa de Remocao": "atendimento_concluido",
	"Desistência da solicitação": "atendimento_concluido",
	"Desistencia da solicitacao": "atendimento_concluido",
	"Sem Desfecho/Casa Fechada/Não há paciente": "atendimento_concluido",
	"Sem Desfecho/Casa Fechada/Nao ha paciente": "atendimento_concluido",
	"Outros Desfechos": "atendimento_concluido",
	"Não necessita/Sem Condições Clínicas": "atendimento_concluido",
	"Nao necessita/Sem Condicoes Clinicas": "atendimento_concluido",
	"Removido por Particulares": "removido_particulares",
	"Removido pelos Bombeiros/CIODS": "removido_bombeiros",
	"Óbito no Local/Atendimento": "obito_local",
	"Obito no Local/Atendimento": "obito_local",
};

function normalizeOutcomeBreakdown(raw: Map<string | null, number>): {
	total: number;
	atendimento_concluido: number;
	removido_particulares: number;
	removido_bombeiros: number;
	obito_local: number;
} {
	let atendimento_concluido = 0;
	let removido_particulares = 0;
	let removido_bombeiros = 0;
	let obito_local = 0;
	let total = 0;

	for (const [outcome, cnt] of raw) {
		const n = Number(cnt) || 0;
		if (!outcome) continue;
		total += n;
		const bucket = OUTCOME_VALIDOS_MAP[outcome];
		if (bucket === "atendimento_concluido") atendimento_concluido += n;
		else if (bucket === "removido_particulares") removido_particulares += n;
		else if (bucket === "removido_bombeiros") removido_bombeiros += n;
		else if (bucket === "obito_local") obito_local += n;
		else atendimento_concluido += n;
	}

	return {
		total,
		atendimento_concluido,
		removido_particulares,
		removido_bombeiros,
		obito_local,
	};
}

function normalizeGender(raw: Record<string, number>): Record<string, number> {
	const result: Record<string, number> = {
		masculino: 0,
		feminino: 0,
		nao_informado: 0,
	};
	for (const [key, value] of Object.entries(raw)) {
		const lower = key.toLowerCase();
		if (lower === "masculino" || lower === "m") result.masculino += value || 0;
		else if (lower === "feminino" || lower === "f")
			result.feminino += value || 0;
		else result.nao_informado += value || 0;
	}
	return result;
}

function normalizeAgeGroups(
	raw: Record<string, number>,
): Record<string, number> {
	const unknown = Number(raw.unknown) || 0;
	return {
		"0_17_anos": Number(raw["0-17"]) || 0,
		"18_29_anos": Number(raw["18-29"]) || 0,
		"30_49_anos": Number(raw["30-49"]) || 0,
		"50_64_anos": Number(raw["50-64"]) || 0,
		"65_mais_anos": Number(raw["65+"]) || 0,
		nao_informado: unknown,
	};
}

export const cities: AppRouteHandler<CitiesRoute> = async (c) => {
	const { start_year, end_year } = c.req.valid("query");

	const yearCondition = end_year
		? sql`EXTRACT(YEAR FROM ${emergencyCalls.date})::int BETWEEN ${start_year} AND ${end_year}`
		: sql`EXTRACT(YEAR FROM ${emergencyCalls.date})::int >= ${start_year}`;

	const citiesData = await db
		.select({
			municipality: emergencyCalls.municipality,
			count: count(),
		})
		.from(emergencyCalls)
		.where(yearCondition)
		.groupBy(emergencyCalls.municipality)
		.orderBy(sql`COUNT(*) DESC`);

	const cidades = await Promise.all(
		citiesData.map(async (city, index) => {
			const name = city.municipality || "UNKNOWN";

			const yearlyData = await db
				.select({
					ano: sql<number>`EXTRACT(YEAR FROM ${emergencyCalls.date})::int`,
					total_chamados: count(),
					validos: sql<number>`COUNT(*) FILTER (WHERE ${emergencyCalls.outcome_category} IS NOT NULL)`,
					invalidos: sql<number>`COUNT(*) FILTER (WHERE ${emergencyCalls.outcome_category} IS NULL)`,
				})
				.from(emergencyCalls)
				.where(and(yearCondition, eq(emergencyCalls.municipality, name)))
				.groupBy(sql`EXTRACT(YEAR FROM ${emergencyCalls.date})`)
				.orderBy(sql`EXTRACT(YEAR FROM ${emergencyCalls.date})`);

			const historico_anual = await Promise.all(
				yearlyData.map(async (yr) => {
					const yearConditions = sql`EXTRACT(YEAR FROM ${emergencyCalls.date}) = ${yr.ano} AND ${emergencyCalls.municipality} = ${name}`;

					const genderRows = await db
						.select({
							gender: emergencyCalls.gender,
							count: count(),
						})
						.from(emergencyCalls)
						.where(sql`${yearConditions}`)
						.groupBy(emergencyCalls.gender);

					const ageRows = await db
						.select({
							age_group: sql<string>`
								CASE
									WHEN ${emergencyCalls.age} < 18 THEN '0-17'
									WHEN ${emergencyCalls.age} BETWEEN 18 AND 29 THEN '18-29'
									WHEN ${emergencyCalls.age} BETWEEN 30 AND 49 THEN '30-49'
									WHEN ${emergencyCalls.age} BETWEEN 50 AND 64 THEN '50-64'
									WHEN ${emergencyCalls.age} >= 65 THEN '65+'
									ELSE 'unknown'
								END
							`,
							count: count(),
						})
						.from(emergencyCalls)
						.where(sql`${yearConditions}`)
						.groupBy(sql`
							CASE
								WHEN ${emergencyCalls.age} < 18 THEN '0-17'
								WHEN ${emergencyCalls.age} BETWEEN 18 AND 29 THEN '18-29'
								WHEN ${emergencyCalls.age} BETWEEN 30 AND 49 THEN '30-49'
								WHEN ${emergencyCalls.age} BETWEEN 50 AND 64 THEN '50-64'
								WHEN ${emergencyCalls.age} >= 65 THEN '65+'
								ELSE 'unknown'
							END
						`);

					const categoryRows = await db
						.select({
							category: emergencyCalls.subtype,
							count: count(),
						})
						.from(emergencyCalls)
						.where(sql`${yearConditions}`)
						.groupBy(emergencyCalls.subtype);

					const outcomeRows = await db
						.select({
							outcome: emergencyCalls.outcome_category,
							count: count(),
						})
						.from(emergencyCalls)
						.where(sql`${yearConditions}`)
						.groupBy(emergencyCalls.outcome_category);

					const outcomeRaw = new Map<string | null, number>();
					for (const row of outcomeRows) {
						outcomeRaw.set(row.outcome, Number(row.count) || 0);
					}

					const genderRaw = genderRows.reduce(
						(acc, r) => {
							acc[r.gender || "null"] = r.count;
							return acc;
						},
						{} as Record<string, number>,
					);

					const ageRaw = ageRows.reduce(
						(acc, r) => {
							acc[r.age_group] = r.count;
							return acc;
						},
						{} as Record<string, number>,
					);

					const categoryRaw = categoryRows.reduce(
						(acc, r) => {
							if (r.category) acc[r.category] = r.count;
							return acc;
						},
						{} as Record<string, number>,
					);

					const validosObj = normalizeOutcomeBreakdown(outcomeRaw);
					const invalidosNum = Number(yr.invalidos) || 0;

					return {
						ano: yr.ano,
						total_chamados: yr.total_chamados,
						total: validosObj.total + invalidosNum,
						validos: validosObj,
						invalidos: invalidosNum,
						por_sexo: normalizeGender(genderRaw),
						por_faixa_etaria: normalizeAgeGroups(ageRaw),
						por_categoria: normalizeCategories(categoryRaw),
					};
				}),
			);

			return {
				municipio_samu: name,
				count: city.count,
				name,
				display_name: displayName(name),
				rmr: RMR_CITIES.has(name),
				ranking: index + 1,
				historico_anual,
			};
		}),
	);

	return c.json({ cidades });
};
