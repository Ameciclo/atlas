import { and, count, desc, eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { db } from "../../db/index.js";
import { trafficDeaths } from "../../db/schema.js";
import type { AppRouteHandler } from "../../lib/types.js";
import type * as routes from "./by-city.routes.js";

// City code to name mapping for RMR (Região Metropolitana do Recife)
const CITY_NAMES: Record<number, string> = {
	2600054: "Abreu e Lima",
	2601052: "Araçoiaba",
	2602902: "Cabo de Santo Agostinho",
	2603454: "Camaragibe",
	2606804: "Igarassu",
	2607604: "Ilha de Itamaracá",
	2607208: "Ipojuca",
	2607752: "Itapissuma",
	2607901: "Jaboatão dos Guararapes",
	2609402: "Moreno",
	2609600: "Olinda",
	2610707: "Paulista",
	2611606: "Recife",
	2613701: "São Lourenço da Mata",
};

export const getDeathsByCity: AppRouteHandler<
	typeof routes.getDeathsByCity
> = async (c) => {
	const { year, location_type = "occurrence" } = c.req.valid("query");

	// Determine which field to use based on location_type
	const cityCodeField =
		location_type === "occurrence"
			? trafficDeaths.codmunocor
			: trafficDeaths.codmunres;

	// Build conditions array with explicit type
	const conditions: ReturnType<typeof eq>[] = [];
	if (year) {
		conditions.push(eq(trafficDeaths.data_year, year));
	}

	// Query deaths grouped by city
	const results = await db
		.select({
			city_code: cityCodeField,
			total_deaths: count(),
		})
		.from(trafficDeaths)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.groupBy(cityCodeField)
		.orderBy(desc(count()));

	// Map city codes to names and filter out null city codes
	const cities = results
		.filter((r) => r.city_code !== null)
		.map((r) => ({
			city_code: r.city_code as number,
			city_name: CITY_NAMES[r.city_code as number] || null,
			total_deaths: r.total_deaths,
		}));

	const total = cities.reduce((sum, city) => sum + city.total_deaths, 0);

	return c.json(
		{
			location_type,
			year: year ?? null,
			cities,
			total,
		},
		HttpStatusCodes.OK,
	);
};
