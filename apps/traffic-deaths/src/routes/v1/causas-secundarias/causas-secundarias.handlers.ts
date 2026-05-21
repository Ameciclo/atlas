import { and, count, desc, eq, like, sql } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { trafficDeaths } from "../../../db/schema.js";
import type { AppRouteHandler } from "../../../lib/types.js";
import type { getCausasSecundariasV1 } from "./causas-secundarias.routes.js";

const CID10_DESCRIPTIONS: Record<string, string> = {
	V0: "Pedestre traumatizado em acidente de transporte",
	V1: "Ciclista traumatizado em acidente de transporte",
	V2: "Motociclista traumatizado em acidente de transporte",
	V3: "Ocupante de triciclo traumatizado em acidente de transporte",
	V4: "Ocupante de automóvel traumatizado em acidente de transporte",
	V5: "Ocupante de caminhonete traumatizado em acidente de transporte",
	V6: "Ocupante de veículo pesado traumatizado em acidente de transporte",
	V7: "Ocupante de ônibus traumatizado em acidente de transporte",
	V8: "Outros acidentes de transporte terrestre",
	V9: "Acidente de transporte não especificado",
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

type Condition = ReturnType<typeof eq> | ReturnType<typeof like> | ReturnType<typeof sql>;

export const getCausasSecundariasV1Handler: AppRouteHandler<
	typeof getCausasSecundariasV1
> = async (c) => {
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
	const modoTransporte = query.modoTransporte || query.transportMode;

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
	if (modoTransporte) {
		const pattern = TRANSPORT_MODE_PATTERNS[modoTransporte.toLowerCase()];
		if (pattern) {
			conditions.push(like(trafficDeaths.causabas, pattern));
		}
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const rows = await db
		.select({
			codigo: trafficDeaths.causabas,
			total: count(),
		})
		.from(trafficDeaths)
		.where(where)
		.groupBy(trafficDeaths.causabas)
		.orderBy(desc(count()))
		.limit(50);

	const totalGeral = rows.reduce((sum, r) => sum + r.total, 0);

	const causas = rows.map((r) => ({
		codigo: r.codigo,
		descricao:
			CID10_DESCRIPTIONS[r.codigo.substring(0, 2)] ||
			CID10_DESCRIPTIONS[r.codigo.substring(0, 3)] ||
			`Código CID-10: ${r.codigo}`,
		total: r.total,
		percentual:
			totalGeral > 0
				? Number.parseFloat(((r.total / totalGeral) * 100).toFixed(1))
				: 0,
	}));

	return c.json({ causas, total: totalGeral });
};
