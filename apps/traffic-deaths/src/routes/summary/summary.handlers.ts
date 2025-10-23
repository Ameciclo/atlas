import { count, eq } from "drizzle-orm";
import type { AppRouteHandler } from "../../lib/types.js";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { db } from "../../db/index.js";
import { trafficDeaths } from "../../db/schema.js";
import * as routes from "./summary.routes.js";

export const getSummary: AppRouteHandler<typeof routes.getSummary> = async (
	c,
) => {
	const { year } = c.req.valid("query");

	try {
		let result;

		if (year) {
			// Count deaths for specific year
			result = await db
				.select({ count: count() })
				.from(trafficDeaths)
				.where(eq(trafficDeaths.data_year, year));
		} else {
			// Count all deaths
			result = await db.select({ count: count() }).from(trafficDeaths);
		}

		const total = result[0]?.count ?? 0;

		return c.json({
			total_deaths: total,
			year: year ?? null,
			message: year
				? `Total traffic deaths in ${year}`
				: "Total traffic deaths (all years)",
		});
	} catch (error) {
		c.get("logger").error("Error fetching summary", { error });
		return c.json(
			{
				total_deaths: 0,
				year: year ?? null,
				message: "Error fetching data",
			},
			HttpStatusCodes.INTERNAL_SERVER_ERROR,
		);
	}
};

