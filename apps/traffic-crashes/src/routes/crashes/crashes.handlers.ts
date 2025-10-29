import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";
import { db } from "../../db/index.js";
import type { AppRouteHandler } from "../../lib/types.js";
import type { GetByIdRoute, ListRoute } from "./crashes.routes.js";

export const list: AppRouteHandler<ListRoute> = async (c) => {
	const { start_date, end_date } = c.req.valid("query");

	if (start_date || end_date) {
		// Filter by date range if provided
		const crashes = await db.query.geolocatedCrashes.findMany({
			where(fields, operators) {
				const conditions = [];
				if (start_date) {
					conditions.push(
						operators.gte(fields.timestamp, new Date(start_date)),
					);
				}
				if (end_date) {
					conditions.push(operators.lte(fields.timestamp, new Date(end_date)));
				}
				return conditions.length > 1
					? operators.and(...conditions)
					: conditions[0];
			},
		});
		return c.json(crashes);
	}

	// Get all crashes
	const crashes = await db.query.geolocatedCrashes.findMany();
	return c.json(crashes);
};

export const getById: AppRouteHandler<GetByIdRoute> = async (c) => {
	const { id } = c.req.valid("param");

	const crash = await db.query.geolocatedCrashes.findFirst({
		where(fields, operators) {
			return operators.eq(fields.id, Number(id));
		},
	});

	if (!crash) {
		return c.json(
			{
				message: HttpStatusPhrases.NOT_FOUND,
			},
			HttpStatusCodes.NOT_FOUND,
		);
	}

	return c.json(crash, HttpStatusCodes.OK);
};
