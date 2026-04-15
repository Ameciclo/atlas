import type { AppRouteHandler } from "../../lib/types.js";
import { HTTPException } from "hono/http-exception";
import { StreetService } from "../../lib/street-service.js";
import type * as routes from "./streets.routes.js";

export const searchStreets: AppRouteHandler<routes.SearchStreetsRoute> = async (
	c,
) => {
	try {
		const db = c.get("db");
		const streetService = new StreetService(db);
		const { q, limit, by_length, by_elements } = c.req.valid("query");

		const matches = await streetService.searchStreets(
			q,
			limit,
			by_length,
			by_elements,
		);

		return c.json({ matches }, 200);
	} catch (error) {
		console.error("Street search error:", error);
		throw new HTTPException(500, {
			message: "Failed to search streets",
		});
	}
};

export const getStreetDetails: AppRouteHandler<
	routes.GetStreetDetailsRoute
> = async (c) => {
	try {
		const db = c.get("db");
		const streetService = new StreetService(db);
		const { streetId } = c.req.valid("param");

		const street = await streetService.getStreetById(streetId);

		if (!street) {
			throw new HTTPException(404, {
				message: "Street not found",
			});
		}

		return c.json(street, 200);
	} catch (error) {
		if (error instanceof HTTPException) {
			throw error;
		}
		throw new HTTPException(500, {
			message: "Failed to get street details",
		});
	}
};
