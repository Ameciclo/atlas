import { and, count, desc, eq, inArray } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { db } from "../../db/index.js";
import { trafficDeaths } from "../../db/schema.js";
import { RMR_6_DIGIT_CODES, RMR_6_DIGIT_NAMES } from "../../lib/rmr.js";
import type { AppRouteHandler } from "../../lib/types.js";
import type * as routes from "./by-city.routes.js";

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
	const conditions: ReturnType<typeof eq | typeof inArray>[] = [
		inArray(cityCodeField, RMR_6_DIGIT_CODES),
	];
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
		.where(and(...conditions))
		.groupBy(cityCodeField)
		.orderBy(desc(count()));

	// Map city codes to names and filter out null city codes
	const cities = results
		.filter((r) => r.city_code !== null)
		.map((r) => ({
			city_code: r.city_code as number,
			city_name: RMR_6_DIGIT_NAMES[r.city_code as number] || null,
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
