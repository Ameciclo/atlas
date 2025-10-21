import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";
import { db } from "../../db/index.js";
import type { AppRouteHandler } from "../../lib/types.js";
import type { GetByEventIdRoute, GetByIdRoute } from "./sessions.routes.js";

export const getByEventId: AppRouteHandler<GetByEventIdRoute> = async (c) => {
	const { id } = c.req.valid("param");

	// First check if event exists
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

	// Get all sessions for this event
	const sessions = await db.query.countingSessions.findMany({
		where(fields, operators) {
			return operators.eq(fields.event_id, id);
		},
		orderBy: (sessions, { asc }) => [asc(sessions.start_time)],
	});

	return c.json(sessions, HttpStatusCodes.OK);
};

export const getById: AppRouteHandler<GetByIdRoute> = async (c) => {
	const { id } = c.req.valid("param");

	const session = await db.query.countingSessions.findFirst({
		where(fields, operators) {
			return operators.eq(fields.id, id);
		},
	});

	if (!session) {
		return c.json(
			{
				message: HttpStatusPhrases.NOT_FOUND,
			},
			HttpStatusCodes.NOT_FOUND,
		);
	}

	return c.json(session, HttpStatusCodes.OK);
};
