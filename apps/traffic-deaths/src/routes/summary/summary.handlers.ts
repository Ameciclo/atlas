import { count, eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { db } from "../../db/index.js";
import { trafficDeaths } from "../../db/schema.js";
import type { AppRouteHandler } from "../../lib/types.js";
import type * as routes from "./summary.routes.js";

export const getSummary: AppRouteHandler<typeof routes.getSummary> = async (
	c,
) => {
	const { year } = c.req.valid("query");

	const result = year
		? await db
				.select({ count: count() })
				.from(trafficDeaths)
				.where(eq(trafficDeaths.data_year, year))
		: await db.select({ count: count() }).from(trafficDeaths);

	const total = result[0]?.count ?? 0;

	return c.json(
		{
			total_deaths: total,
			year: year ?? null,
			message: year
				? `Total traffic deaths in ${year}`
				: "Total traffic deaths (all years)",
		},
		HttpStatusCodes.OK,
	);
};
