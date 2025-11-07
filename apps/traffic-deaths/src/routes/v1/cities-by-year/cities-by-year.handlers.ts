import type { AppRouteHandler } from "../../../lib/types.js";
import type { getCitiesByYearV1 } from "./cities-by-year.routes.js";

export const getCitiesByYearV1Handler: AppRouteHandler<typeof getCitiesByYearV1> = async (c) => {
	const { tipoLocal } = c.req.valid("query");
	
	// TODO: Implement actual data fetching from database
	return c.json({
		tipo: tipoLocal === "residencia" ? "Local de Residência" : "Local de Ocorrência",
		anos: [2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022],
		cidades: [
			{
				id: 2611606,
				nome: "Recife",
				"2013": 50,
				"2014": 55,
				"2015": 48,
				"2016": 52,
				"2017": 60,
				"2018": 58,
				"2019": 65,
				"2020": 45,
				"2021": 50,
				"2022": 55,
				total: 538,
			},
		],
	});
};