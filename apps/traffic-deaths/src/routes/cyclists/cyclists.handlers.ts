import { and, count, eq, like } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { db } from "../../db/index.js";
import { trafficDeaths } from "../../db/schema.js";
import type { AppRouteHandler } from "../../lib/types.js";
import type * as routes from "./cyclists.routes.js";

export const getCyclistDeaths: AppRouteHandler<
	typeof routes.getCyclistDeaths
> = async (c) => {
	const { year, city_code } = c.req.valid("query");

	// Build conditions for cyclist deaths (CID-10 codes V10-V19)
	const conditions = [like(trafficDeaths.causabas, "V1%")];

	if (year) {
		conditions.push(eq(trafficDeaths.data_year, year));
	}

	if (city_code) {
		conditions.push(eq(trafficDeaths.codmunocor, city_code));
	}

	// Count cyclist deaths
	const cyclistResult = await db
		.select({ count: count() })
		.from(trafficDeaths)
		.where(and(...conditions));

	const cyclistDeaths = cyclistResult[0]?.count ?? 0;

	// Count total deaths for percentage calculation
	const totalConditions = [];
	if (year) {
		totalConditions.push(eq(trafficDeaths.data_year, year));
	}
	if (city_code) {
		totalConditions.push(eq(trafficDeaths.codmunocor, city_code));
	}

	const totalResult = await db
		.select({ count: count() })
		.from(trafficDeaths)
		.where(totalConditions.length > 0 ? and(...totalConditions) : undefined);

	const totalDeaths = totalResult[0]?.count ?? 0;
	const percentage = totalDeaths > 0 ? (cyclistDeaths / totalDeaths) * 100 : 0;

	// Build message
	let message = "Cyclist deaths";
	if (year && city_code) {
		message += ` in city ${city_code} for ${year}`;
	} else if (year) {
		message += ` in ${year}`;
	} else if (city_code) {
		message += ` in city ${city_code}`;
	} else {
		message += " (all years and cities)";
	}

	return c.json(
		{
			total_cyclist_deaths: cyclistDeaths,
			year: year ?? null,
			city_code: city_code ?? null,
			percentage_of_total: Number.parseFloat(percentage.toFixed(2)),
			message,
		},
		HttpStatusCodes.OK,
	);
};
