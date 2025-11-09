import { and, eq, gte, lte, } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";
import { db } from "../../db/index.js";
import {
	countingEvents,
	countingLocations,
	countingSessions,
	sessionMovements,
	cities,
} from "../../db/schema.js";
import type { AppRouteHandler } from "../../lib/types.js";
import type {
	GetByIdRoute,
	GetByLocationIdRoute,
	GetDetailsByIdRoute,
	ListRoute,
} from "./events.routes.js";

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
			.where(and(eq(countingLocations.city, city), ...conditions));

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

export const getDetailsById: AppRouteHandler<GetDetailsByIdRoute> = async (
	c,
) => {
	const { id } = c.req.valid("param");

	// Get event with location
	const eventWithLocation = await db
		.select()
		.from(countingEvents)
		.leftJoin(
			countingLocations,
			eq(countingEvents.location_id, countingLocations.id),
		)
		.where(eq(countingEvents.id, id))
		.limit(1);

	if (eventWithLocation.length === 0) {
		return c.json(
			{ message: HttpStatusPhrases.NOT_FOUND },
			HttpStatusCodes.NOT_FOUND,
		);
	}

	const event = eventWithLocation[0]?.counting_events;
	const location = eventWithLocation[0]?.counting_locations;

	if (!event) {
		return c.json(
			{ message: HttpStatusPhrases.NOT_FOUND },
			HttpStatusCodes.NOT_FOUND,
		);
	}

	// Get city data
	const cityData = await db
		.select()
		.from(cities)
		.where(
			and(
				eq(cities.name, location?.city || ""),
				eq(cities.state, location?.state || ""),
			),
		)
		.limit(1);

	// Create slug
	const slugName =
		location?.name
			?.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.replace(/[^\w\s]/gi, "")
			.replace(/\s+/g, "-")
			.toLowerCase() || "unknown";

	const slugDate = new Date(event.counting_date).toISOString().slice(0, 10);
	const slug = `${id}-${slugDate}-${slugName}`;

	// Get sessions
	const sessions = await db
		.select()
		.from(countingSessions)
		.where(eq(countingSessions.event_id, id));

	const summary = {
		max_hour: 0,
		total_cyclists: 0,
		total_cargo: 0,
		total_helmet: 0,
		total_juveniles: 0,
		total_motor: 0,
		total_ride: 0,
		total_service: 0,
		total_shared_bike: 0,
		total_sidewalk: 0,
		total_women: 0,
		total_wrong_way: 0,
	};

	const sessionsData: Record<string, {
		start_time: string;
		end_time: string;
		total_cyclists: number;
		quantitative: Record<string, number>;
		characteristics: Record<string, unknown>;
	}> = {};
	const directions: Record<string, string> = {};

	for (const session of sessions) {
		// Get movements for this session
		const movements = await db
			.select()
			.from(sessionMovements)
			.where(eq(sessionMovements.session_id, session.id));

		const sessionTotal = movements.reduce((sum, m) => sum + m.count, 0);
		summary.total_cyclists += sessionTotal;
		if (sessionTotal > summary.max_hour) summary.max_hour = sessionTotal;

		// Build quantitative data from movements
		const quantitative: Record<string, number> = {};
		movements.forEach((m) => {
			const key = `${m.from_direction}_${m.to_direction}`;
			quantitative[key] = (quantitative[key] || 0) + m.count;
			directions[m.from_direction] = m.from_direction;
			directions[m.to_direction] = m.to_direction;
		});

		// Get characteristics from session JSONB
		const characteristics = (session.characteristics as Record<string, unknown>) || {};
		summary.total_cargo += characteristics.cargo || 0;
		summary.total_helmet += characteristics.helmet || 0;
		summary.total_juveniles += characteristics.juveniles || 0;
		summary.total_motor += characteristics.motor || 0;
		summary.total_ride += characteristics.ride || 0;
		summary.total_service += characteristics.service || 0;
		summary.total_shared_bike += characteristics.shared_bike || 0;
		summary.total_sidewalk += characteristics.sidewalk || 0;
		summary.total_women += characteristics.women || 0;
		summary.total_wrong_way += characteristics.wrong_way || 0;

		sessionsData[session.id] = {
			start_time: session.start_time.toISOString(),
			end_time: session.end_time.toISOString(),
			total_cyclists: sessionTotal,
			quantitative,
			characteristics,
		};
	}

	const response = {
		id: event.id,
		slug,
		name: location?.name || "Unknown",
		date: event.counting_date,
		city: cityData[0] || {
			id: 0,
			name: location?.city || "Unknown",
			state: location?.state || "Unknown",
			full_state: "Unknown",
			rmr: false,
		},
		coordinates: [
			{
				point: {
					x: parseFloat(location?.longitude || "0"),
					y: parseFloat(location?.latitude || "0"),
				},
				type: "Point",
				name: location?.name || "Unknown",
			},
		],
		directions,
		sessions: sessionsData,
		summary,
	};

	return c.json(response, HttpStatusCodes.OK);
};
