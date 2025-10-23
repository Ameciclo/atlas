import type { AppRouteHandler } from "../../lib/types.js";
import * as HttpStatusCodes from "stoker/http-status-codes";
import * as routes from "./summary.routes.js";

export const getSummary: AppRouteHandler<typeof routes.getSummary> = async (
	c,
) => {
	const { year } = c.req.valid("query");

	try {
		// TODO: Replace with actual database query once migrations are run
		// For now, return mock data to test the route
		const total = 0;

		return c.json({
			total_deaths: total,
			year: year ?? null,
			message: year
				? `Total traffic deaths in ${year} (mock data)`
				: "Total traffic deaths (all years) (mock data)",
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

