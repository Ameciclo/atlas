import { and, count, eq, like, sql } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { trafficDeaths } from "../../../db/schema.js";
import { RMR_6_DIGIT_NAMES } from "../../../lib/rmr.js";
import {
	classifyFaixaEtaria,
	idadeObitoAnos,
} from "../../../lib/idade.js";
import type { AppRouteHandler } from "../../../lib/types.js";
import type { getFiltrosV1 } from "./filtros.routes.js";

const SEXO_MAP: Record<string, string> = {
	0: "Ignorado",
	1: "Masculino",
	2: "Feminino",
};

const RACACOR_MAP: Record<string, string> = {
	1: "Branca",
	2: "Preta",
	3: "Amarela",
	4: "Parda",
	5: "Indígena",
	9: "Ignorado",
};

const LOCOCOR_MAP: Record<string, string> = {
	1: "Hospital",
	2: "Outros estabelecimentos de saúde",
	3: "Domicílio",
	4: "Via pública",
	5: "Outros",
	9: "Ignorado",
};

const TRANSPORT_MODE_PATTERNS: Record<string, string> = {
	pedestre: "V0%",
	ciclista: "V1%",
	motociclista: "V2%",
	"ocupante de triciclo": "V3%",
	"ocupante de automóvel": "V4%",
	"ocupante de caminhonete": "V5%",
	"ocupante de veículo pesado": "V6%",
	"ocupante de ônibus": "V7%",
	"outros modos": "V8%",
	"não especificado": "V99%",
};

const MODE_PATTERN_TO_NAME: Record<string, string> = {
	V0: "Pedestre",
	V1: "Ciclista",
	V2: "Motociclista",
	V3: "Ocupante de triciclo",
	V4: "Ocupante de automóvel",
	V5: "Ocupante de caminhonete",
	V6: "Ocupante de veículo pesado",
	V7: "Ocupante de ônibus",
	V8: "Outros modos",
	V99: "Não especificado",
};

function getModeName(causabas: string): string {
	const prefix = causabas.substring(0, 3);
	if (prefix === "V99") return "Não especificado";
	const shortPrefix = prefix.substring(0, 2);
	return MODE_PATTERN_TO_NAME[shortPrefix] || "Outros modos";
}

type Condition = ReturnType<typeof eq> | ReturnType<typeof like> | ReturnType<typeof sql>;

export const getFiltrosV1Handler: AppRouteHandler<typeof getFiltrosV1> = async (
	c,
) => {
	const query = c.req.valid("query");

	const cityIdRaw = query.cityId || query.municipio;
	const cityId =
		cityIdRaw && cityIdRaw > 999999
			? Math.floor(cityIdRaw / 10)
			: cityIdRaw;
	const locationType =
		query.tipoLocal === "residencia" || query.locationType === "residence"
			? ("residence" as const)
			: ("occurrence" as const);
	const anoInicio = query.anoInicio || query.startYear;
	const anoFim = query.anoFim || query.endYear;
	const sexo = query.sexo || query.gender;
	const racacor = query.racacor || query.race;
	const ageMin = query.faixaEtariaMin ?? query.ageMin;
	const ageMax = query.faixaEtariaMax ?? query.ageMax;
	const modoTransporte = query.modoTransporte || query.transportMode;
	const localOcorrencia = query.localOcorrenciaObito || query.deathLocation;

	const filters: Record<string, unknown> = {
		tipoLocal: locationType === "residence" ? "residencia" : "ocorrencia",
	};
	if (anoInicio) filters.anoInicio = anoInicio;
	if (anoFim) filters.anoFim = anoFim;
	if (cityIdRaw) filters.municipio = cityIdRaw;
	if (sexo) filters.sexo = sexo;
	if (racacor) filters.racacor = racacor;
	if (ageMin !== undefined) filters.faixaEtariaMin = ageMin;
	if (ageMax !== undefined) filters.faixaEtariaMax = ageMax;
	if (modoTransporte) filters.modoTransporte = [modoTransporte];
	if (localOcorrencia) filters.localOcorrenciaObito = localOcorrencia;

	const conditions: Condition[] = [];

	if (cityId) {
		const cityField =
			locationType === "residence"
				? trafficDeaths.codmunres
				: trafficDeaths.codmunocor;
		conditions.push(eq(cityField, cityId));
	}
	if (anoInicio) {
		conditions.push(sql`${trafficDeaths.data_year} >= ${anoInicio}`);
	}
	if (anoFim) {
		conditions.push(sql`${trafficDeaths.data_year} <= ${anoFim}`);
	}
	if (sexo) {
		conditions.push(eq(trafficDeaths.sexo, sexo));
	}
	if (racacor) {
		conditions.push(eq(trafficDeaths.racacor, racacor));
	}
	if (ageMin !== undefined) {
		conditions.push(sql`${trafficDeaths.idade} >= ${ageMin}`);
	}
	if (ageMax !== undefined) {
		conditions.push(sql`${trafficDeaths.idade} <= ${ageMax}`);
	}
	if (modoTransporte) {
		const pattern =
			TRANSPORT_MODE_PATTERNS[modoTransporte.toLowerCase()];
		if (pattern) {
			conditions.push(like(trafficDeaths.causabas, pattern));
		}
	}
	if (localOcorrencia) {
		conditions.push(eq(trafficDeaths.lococor, localOcorrencia));
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const [porAnoRows, porSexoRows, porRacaCorRows, porMunicipioRows, porLocOcorRows, totalGeralRows, faixaEtariaRows] =
		await Promise.all([
			db
				.select({
					year: trafficDeaths.data_year,
					total: count(),
				})
				.from(trafficDeaths)
				.where(where)
				.groupBy(trafficDeaths.data_year)
				.orderBy(trafficDeaths.data_year),
			db
				.select({
					codigo: trafficDeaths.sexo,
					total: count(),
				})
				.from(trafficDeaths)
				.where(where)
				.groupBy(trafficDeaths.sexo),
			db
				.select({
					codigo: trafficDeaths.racacor,
					total: count(),
				})
				.from(trafficDeaths)
				.where(where)
				.groupBy(trafficDeaths.racacor),
			db
				.select({
					city_code: locationType === "residence"
						? trafficDeaths.codmunres
						: trafficDeaths.codmunocor,
					total: count(),
				})
				.from(trafficDeaths)
				.where(where)
				.groupBy(
					locationType === "residence"
						? trafficDeaths.codmunres
						: trafficDeaths.codmunocor,
				),
			db
				.select({
					codigo: trafficDeaths.lococor,
					total: count(),
				})
				.from(trafficDeaths)
				.where(where)
				.groupBy(trafficDeaths.lococor),
			db
				.select({ total: count() })
				.from(trafficDeaths)
				.where(where),
			db
				.select({
					idade: trafficDeaths.idade,
					total: count(),
				})
				.from(trafficDeaths)
				.where(where)
				.groupBy(trafficDeaths.idade),
		]);

	// porModoTransporte: use CASE in SQL
	const modeRows = await db
		.select({
			pedestre: sql<number>`COALESCE(SUM(CASE WHEN ${trafficDeaths.causabas} LIKE 'V0%' THEN 1 ELSE 0 END), 0)`,
			ciclista: sql<number>`COALESCE(SUM(CASE WHEN ${trafficDeaths.causabas} LIKE 'V1%' THEN 1 ELSE 0 END), 0)`,
			motociclista: sql<number>`COALESCE(SUM(CASE WHEN ${trafficDeaths.causabas} LIKE 'V2%' THEN 1 ELSE 0 END), 0)`,
			triciclo: sql<number>`COALESCE(SUM(CASE WHEN ${trafficDeaths.causabas} LIKE 'V3%' THEN 1 ELSE 0 END), 0)`,
			automovel: sql<number>`COALESCE(SUM(CASE WHEN ${trafficDeaths.causabas} LIKE 'V4%' THEN 1 ELSE 0 END), 0)`,
			caminhonete: sql<number>`COALESCE(SUM(CASE WHEN ${trafficDeaths.causabas} LIKE 'V5%' THEN 1 ELSE 0 END), 0)`,
			veiculo_pesado: sql<number>`COALESCE(SUM(CASE WHEN ${trafficDeaths.causabas} LIKE 'V6%' THEN 1 ELSE 0 END), 0)`,
			onibus: sql<number>`COALESCE(SUM(CASE WHEN ${trafficDeaths.causabas} LIKE 'V7%' THEN 1 ELSE 0 END), 0)`,
			outros: sql<number>`COALESCE(SUM(CASE WHEN ${trafficDeaths.causabas} LIKE 'V8%' THEN 1 ELSE 0 END), 0)`,
			nao_especificado: sql<number>`COALESCE(SUM(CASE WHEN ${trafficDeaths.causabas} LIKE 'V99%' THEN 1 ELSE 0 END), 0)`,
		})
		.from(trafficDeaths)
		.where(where);

	const m = modeRows[0];

	const porModoTransporte: Record<string, number> = {};
	if (m) {
		const modeEntries: [string, number][] = [
			["Pedestre", Number(m.pedestre)],
			["Ciclista", Number(m.ciclista)],
			["Motociclista", Number(m.motociclista)],
			["Ocupante de triciclo", Number(m.triciclo)],
			["Ocupante de automóvel", Number(m.automovel)],
			["Ocupante de caminhonete", Number(m.caminhonete)],
			["Ocupante de veículo pesado", Number(m.veiculo_pesado)],
			["Ocupante de ônibus", Number(m.onibus)],
			["Outros modos", Number(m.outros)],
			["Não especificado", Number(m.nao_especificado)],
		];
		for (const [name, val] of modeEntries) {
			if (val > 0) porModoTransporte[name] = val;
		}
	}

	const porAno: Record<string, number> = {};
	for (const r of porAnoRows) {
		if (r.year !== null) porAno[String(r.year)] = r.total;
	}

	const porSexoMapped: Record<string, number> = {};
	for (const r of porSexoRows) {
		if (r.codigo !== null) {
			const desc = SEXO_MAP[r.codigo] || `Código ${r.codigo}`;
			porSexoMapped[desc] = r.total;
		}
	}

	const porRacaCorMapped: Record<string, number> = {};
	for (const r of porRacaCorRows) {
		if (r.codigo !== null) {
			const desc = RACACOR_MAP[r.codigo] || `Código ${r.codigo}`;
			porRacaCorMapped[desc] = r.total;
		}
	}

	const porMunicipioMapped: Record<string, number> = {};
	for (const r of porMunicipioRows) {
		if (r.city_code !== null) {
			const name = RMR_6_DIGIT_NAMES[r.city_code] || `Cidade ${r.city_code}`;
			porMunicipioMapped[name] = r.total;
		}
	}

	const porLocalOcorrenciaObitoMapped: Record<string, number> = {};
	for (const r of porLocOcorRows) {
		if (r.codigo !== null) {
			const desc = LOCOCOR_MAP[r.codigo] || `Código ${r.codigo}`;
			porLocalOcorrenciaObitoMapped[desc] = r.total;
		}
	}

	const porFaixaEtaria: Record<string, number> = {};
	for (const r of faixaEtariaRows) {
		if (r.idade === null) continue;
		const faixa = classifyFaixaEtaria(idadeObitoAnos(r.idade));
		porFaixaEtaria[faixa] = (porFaixaEtaria[faixa] ?? 0) + r.total;
	}

	const totalGeral = totalGeralRows[0]?.total ?? 0;

	// Detailed dados — fetch with limit
	const dadosRows = await db
		.select({
			ano: trafficDeaths.data_year,
			city_code:
				locationType === "residence"
					? trafficDeaths.codmunres
					: trafficDeaths.codmunocor,
			sexo: trafficDeaths.sexo,
			racacor: trafficDeaths.racacor,
			idade: trafficDeaths.idade,
			causabas: trafficDeaths.causabas,
			lococor: trafficDeaths.lococor,
		})
		.from(trafficDeaths)
		.where(where)
		.limit(100);

	const dados = dadosRows.map((r) => ({
		ano: r.ano ?? 0,
		municipio: {
			id: r.city_code ?? 0,
			nome: r.city_code !== null ? (RMR_6_DIGIT_NAMES[r.city_code] || `Cidade ${r.city_code}`) : "Desconhecido",
		},
		sexo: {
			codigo: r.sexo ?? "9",
			descricao: r.sexo !== null ? (SEXO_MAP[r.sexo] || "Ignorado") : "Ignorado",
		},
		racacor: {
			codigo: r.racacor ?? "9",
			descricao: r.racacor !== null ? (RACACOR_MAP[r.racacor] || "Ignorado") : "Ignorado",
		},
		idade: idadeObitoAnos(r.idade) ?? 0,
		idadeOriginal: r.idade ?? 0,
		faixaEtaria: classifyFaixaEtaria(idadeObitoAnos(r.idade)),
		modoTransporte: {
			codigo: r.causabas ? r.causabas.substring(0, 3) : "",
			descricao: getModeName(r.causabas ?? ""),
		},
		localOcorrenciaObito: {
			codigo: r.lococor ?? "9",
			descricao: r.lococor !== null ? (LOCOCOR_MAP[r.lococor] || "Ignorado") : "Ignorado",
		},
		causabas: r.causabas ?? "",
		total: 1,
	}));

	return c.json({
		filtrosAplicados: filters,
		totalGeral,
		resumo: {
			porAno,
			porSexo: porSexoMapped,
			porRacaCor: porRacaCorMapped,
			porFaixaEtaria,
			porMunicipio: porMunicipioMapped,
			porModoTransporte,
			porLocalOcorrenciaObito: porLocalOcorrenciaObitoMapped,
		},
		dados,
	});
};
