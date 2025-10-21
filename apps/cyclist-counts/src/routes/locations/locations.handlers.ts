import type { AppRouteHandler } from "../../lib/types.js";
import type { GetByIdRoute, ListRoute } from "./locations.routes.js";

import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";
import { db } from "../../db/index.js";

export const list: AppRouteHandler<ListRoute> = async (c) => {
	const { city } = c.req.valid("query");

	if (city) {
		// Filter by city if provided
		const locations = await db.query.countingLocations.findMany({
			where(fields, operators) {
				return operators.eq(fields.city, city);
			},
		});
		return c.json(locations);
	}

	// Get all locations
	const locations = await db.query.countingLocations.findMany();
	return c.json(locations);
};

export const getById: AppRouteHandler<GetByIdRoute> = async (c) => {
	const { id } = c.req.valid("param");

	const location = await db.query.countingLocations.findFirst({
		where(fields, operators) {
			return operators.eq(fields.id, id);
		},
	});

	if (!location) {
		return c.json(
			{
				message: HttpStatusPhrases.NOT_FOUND,
			},
			HttpStatusCodes.NOT_FOUND,
		);
	}

	return c.json(location, HttpStatusCodes.OK);
};
