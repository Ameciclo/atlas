import type { AppRouteHandler } from "../../lib/types.js";
import type {
	GetByIdRoute,
	GetByLocationIdRoute,
	ListRoute,
} from "./events.routes.js";

import { and, eq, gte, lte } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";
import { db } from "../../db/index.js";
import { countingEvents, countingLocations } from "../../db/schema.js";

export const list: AppRouteHandler<ListRoute> = async (c) => {
	const { location_id, city, start_date, end_date } = c.req.valid("query");

	// Build where conditions
	const conditions = [];

	if (location_id) {
		conditions.push(eq(countingEvents.location_id, location_id));
	}

	if (start_date) {
		conditions.push(gte(countingEvents.counting_date, start_date));
	}

	if (end_date) {
		conditions.push(lte(countingEvents.counting_date, end_date));
	}

	// If filtering by city, we need to join with locations
	if (city) {
		const events = await db
			.select({
				id: countingEvents.id,
				location_id: countingEvents.location_id,
				counting_date: countingEvents.counting_date,
				start_time: countingEvents.start_time,
				end_time: countingEvents.end_time,
				total_cyclists: countingEvents.total_cyclists,
				max_hour_cyclists: countingEvents.max_hour_cyclists,
				weather_conditions: countingEvents.weather_conditions,
				notes: countingEvents.notes,
				created_at: countingEvents.created_at,
				updated_at: countingEvents.updated_at,
			})
			.from(countingEvents)
			.innerJoin(
				countingLocations,
				eq(countingEvents.location_id, countingLocations.id),
			)
			.where(
				and(eq(countingLocations.city, city), ...conditions),
			);

		return c.json(events);
	}

	// Get events with optional filters
	const events = await db.query.countingEvents.findMany({
		where: conditions.length > 0 ? and(...conditions) : undefined,
		orderBy: (events, { desc }) => [desc(events.counting_date)],
	});

	return c.json(events);
};

export const getById: AppRouteHandler<GetByIdRoute> = async (c) => {
	const { id } = c.req.valid("param");

	const event = await db.query.countingEvents.findFirst({
		where(fields, operators) {
			return operators.eq(fields.id, id);
		},
	});

	if (!event) {
		return c.json(
			{
				message: HttpStatusPhrases.NOT_FOUND,
			},
			HttpStatusCodes.NOT_FOUND,
		);
	}

	return c.json(event, HttpStatusCodes.OK);
};

export const getByLocationId: AppRouteHandler<GetByLocationIdRoute> = async (
	c,
) => {
	const { id } = c.req.valid("param");

	// First check if location exists
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

	// Get all events for this location
	const events = await db.query.countingEvents.findMany({
		where(fields, operators) {
			return operators.eq(fields.location_id, id);
		},
		orderBy: (events, { desc }) => [desc(events.counting_date)],
	});

	return c.json(events, HttpStatusCodes.OK);
};

