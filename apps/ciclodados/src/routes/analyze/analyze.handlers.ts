import type { AppRouteHandler } from "../../lib/types.js";
import { HTTPException } from "hono/http-exception";
import { StreetService } from "../../lib/street-service.js";
import type * as routes from "./analyze.routes.js";

export const analyzePoint: AppRouteHandler<routes.AnalyzePointRoute> = async (
	c,
) => {
	try {
		const db = c.get("db");
		const streetService = new StreetService(db);
		const { lat, lng, buffer } = c.req.valid("json");

		// Find nearby streets
		const nearbyStreets = await streetService.getStreetsByPoint(
			lat,
			lng,
			buffer,
		);

		// TODO: Implement traffic data and cycling data aggregation
		const trafficData = {
			violations: [],
			crashes: [],
		};

		const cyclingData = {
			cycling_counts: [],
			cycling_profile: [],
			cycle_infra: [],
			shared_bicycles: [],
			bike_racks: [],
		};

		return c.json(
			{
				nearby_streets: nearbyStreets,
				traffic_data: trafficData,
				cycling_data: cyclingData,
			},
			200,
		);
	} catch (_error) {
		throw new HTTPException(500, {
			message: "Failed to analyze point",
		});
	}
};
