import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { trafficDeaths } from "../../../db/schema.js";
import type { AppRouteHandler } from "../../../lib/types.js";
import type { getMatrixV1 } from "./matrix.routes.js";

type Condition = ReturnType<typeof eq> | ReturnType<typeof sql>;

const MODE_LABELS = [
	"Pedestre",
	"Ciclista",
	"Motociclista",
	"Automóvel/Caminhonete",
	"Veículo pesado/Ônibus",
	"Objeto fixo",
	"Sem colisão",
	"Outros",
	"Não especificado",
];

function toModeIndex(
	maps: readonly (number | undefined)[],
	char: string,
): number | undefined {
	const n = Number(char);
	if (Number.isNaN(n)) return undefined;
	return maps[n];
}

// Map 2nd char of V-code (victim transport mode) to index in MODE_LABELS
const VICTIM_MAP: (number | undefined)[] = [
	0, // 0: Pedestre
	1, // 1: Ciclista
	2, // 2: Motociclista
	7, // 3: Triciclo → Outros
	3, // 4: Automóvel
	3, // 5: Caminhonete → Automóvel
	4, // 6: Veículo pesado
	4, // 7: Ônibus → Veículo pesado
	7, // 8: Outros
	8, // 9: Não especificado
];

// Map 3rd char of V-code (collision counterpart) to index in MODE_LABELS
const COUNTERPART_MAP: (number | undefined)[] = [
	0, // 0: Pedestre
	1, // 1: Ciclista
	2, // 2: Motociclista
	3, // 3: Automóvel/Caminhonete
	4, // 4: Veículo pesado/Ônibus
	7, // 5: Trem → Outros
	7, // 6: Outros veículos não motorizados → Outros
	5, // 7: Objeto fixo
	6, // 8: Sem colisão
	8, // 9: Não especificado
];

export const getMatrixV1Handler: AppRouteHandler<typeof getMatrixV1> = async (
	c,
) => {
	const query = c.req.valid("query");

	const cityIdRaw = query.cityCode || query.municipio;
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

	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const rows = await db
		.select({
			prefix: sql<string>`LEFT(${trafficDeaths.causabas}, 3)`,
			total: count(),
		})
		.from(trafficDeaths)
		.where(where)
		.groupBy(sql`LEFT(${trafficDeaths.causabas}, 3)`)
		.orderBy(desc(count()));

	const size = MODE_LABELS.length;
	const matrix: number[][] = Array.from({ length: size }, () =>
		Array(size).fill(0),
	);

	for (const row of rows) {
		const prefix = row.prefix;
		if (!prefix || prefix.length < 3) continue;
		if (prefix.charAt(0) !== "V") continue;

		const vi = toModeIndex(VICTIM_MAP, prefix.charAt(1));
		const ci = toModeIndex(COUNTERPART_MAP, prefix.charAt(2));
		if (vi === undefined || ci === undefined) continue;

		const rowArr = matrix[vi];
		if (rowArr === undefined) continue;
		rowArr[ci] = (rowArr[ci] ?? 0) + row.total;
	}

	return c.json({
		matrix,
		labels: {
			rows: MODE_LABELS,
			columns: MODE_LABELS,
		},
	});
};
