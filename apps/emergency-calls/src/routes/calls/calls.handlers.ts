import { and, eq, gte, lte, count } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";
import { db } from "../../db/index.js";
import { emergencyCalls } from "../../db/schema.js";
import type { AppRouteHandler } from "../../lib/types.js";
import type { GetByIdRoute, ListRoute } from "./calls.routes.js";

export const list: AppRouteHandler<ListRoute> = async (c) => {
	const { municipality, subtype, start_date, end_date, limit, offset } = c.req.valid("query");

	// Build where conditions
	const conditions = [];

	if (municipality) {
		conditions.push(eq(emergencyCalls.municipality, municipality));
	}

	if (subtype) {
		conditions.push(eq(emergencyCalls.subtype, subtype));
	}

	if (start_date) {
		conditions.push(gte(emergencyCalls.date, new Date(start_date)));
	}

	if (end_date) {
		conditions.push(lte(emergencyCalls.date, new Date(end_date)));
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Get total count
	const [totalResult] = await db
		.select({ count: count() })
		.from(emergencyCalls)
		.where(whereClause);

	// Get paginated data
	const calls = await db.query.emergencyCalls.findMany({
		where: whereClause,
		limit,
		offset,
		orderBy: (calls, { desc }) => [desc(calls.date), desc(calls.time_minute)],
	});

	return c.json({
		data: calls,
		total: totalResult?.count || 0,
		limit,
		offset,
	});
};

export const getById: AppRouteHandler<GetByIdRoute> = async (c) => {
	const { id } = c.req.valid("param");

	const call = await db.query.emergencyCalls.findFirst({
		where(fields, operators) {
			return operators.eq(fields.id, id);
		},
	});

	if (!call) {
		return c.json(
			{
				message: HttpStatusPhrases.NOT_FOUND,
			},
			HttpStatusCodes.NOT_FOUND,
		);
	}

	return c.json(call, HttpStatusCodes.OK);
};