import { count, inArray } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { trafficDeaths } from "../../../db/schema.js";
import { RMR_6_DIGIT_CODES, RMR_6_TO_7, RMR_CITIES } from "../../../lib/rmr.js";
import type { AppRouteHandler } from "../../../lib/types.js";
import type { getCitiesByYearV1 } from "./cities-by-year.routes.js";

export const getCitiesByYearV1Handler: AppRouteHandler<
	typeof getCitiesByYearV1
> = async (c) => {
	const { tipoLocal = "ocorrencia" } = c.req.valid("query");
	const cityCodeField =
		tipoLocal === "residencia"
			? trafficDeaths.codmunres
			: trafficDeaths.codmunocor;

	const rows = await db
		.select({
			city_code: cityCodeField,
			year: trafficDeaths.data_year,
			total: count(),
		})
		.from(trafficDeaths)
		.where(inArray(cityCodeField, RMR_6_DIGIT_CODES))
		.groupBy(cityCodeField, trafficDeaths.data_year)
		.orderBy(cityCodeField, trafficDeaths.data_year);

	type CityData = {
		id: number;
		nome: string;
		total: number;
		[key: string]: string | number;
	};
	const cityMap = new Map<number, CityData>();
	const yearSet = new Set<number>();

	for (const row of rows) {
		if (row.city_code === null) continue;
		const id7 = RMR_6_TO_7[row.city_code];
		if (id7 === undefined) continue;

		yearSet.add(row.year ?? 0);

		if (!cityMap.has(id7)) {
			cityMap.set(id7, {
				id: id7,
				nome: RMR_CITIES[id7] || `Cidade ${row.city_code}`,
				total: 0,
			});
		}
		const city = cityMap.get(id7);
		if (!city) continue;
		city[String(row.year ?? 0)] = row.total;
		city.total += row.total;
	}

	const anos = Array.from(yearSet).sort();
	const cidades = Array.from(cityMap.values())
		.filter((c) => anos.some((a) => c[String(a)] !== undefined))
		.sort((a, b) => b.total - a.total);

	return c.json({
		tipo:
			tipoLocal === "residencia"
				? "Local de Residência"
				: "Local de Ocorrência",
		anos,
		cidades,
	});
};
