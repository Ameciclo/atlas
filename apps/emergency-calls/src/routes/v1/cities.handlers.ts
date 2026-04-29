import { count, sql } from "drizzle-orm";
import { emergencyCalls } from "../../db/schema.js";
import type { AppRouteHandler } from "../../lib/types.js";
import type { CitiesRoute } from "./cities.routes.js";

export const cities: AppRouteHandler<CitiesRoute> = async (c) => {
	const db = c.get("db");

	const citiesData = await db
		.select({
			municipality: emergencyCalls.municipality,
			count: count(),
		})
		.from(emergencyCalls)
		.groupBy(emergencyCalls.municipality)
		.orderBy(sql`COUNT(*) DESC`);

	const cidades = citiesData.map((city, index) => ({
		municipio_samu: city.municipality || "UNKNOWN",
		count: city.count,
		id: 2611606 + index, // Mock ID
		name: city.municipality || "UNKNOWN",
		rmr: ["RECIFE", "OLINDA", "JABOATAO", "PAULISTA"].includes(
			city.municipality || "",
		),
		ranking: index + 1,
		historico_anual: [
			{
				ano: 2022,
				total_chamados: city.count,
				projecao_total_chamados: Math.floor(city.count * 1.05),
				validos: {
					total: Math.floor(city.count * 0.85),
					atendimento_concluido: Math.floor(city.count * 0.6),
					removido_particulares: Math.floor(city.count * 0.15),
					obito_local: Math.floor(city.count * 0.1),
				},
				invalidos: Math.floor(city.count * 0.15),
				por_sexo: {
					masculino: Math.floor(city.count * 0.7),
					feminino: Math.floor(city.count * 0.3),
				},
				por_faixa_etaria: {
					"18_29_anos": Math.floor(city.count * 0.35),
					"30_49_anos": Math.floor(city.count * 0.3),
				},
				por_categoria: {
					sinistro_moto: Math.floor(city.count * 0.5),
					atropelamento_carro: Math.floor(city.count * 0.3),
				},
			},
		],
	}));

	return c.json({ cidades });
};
