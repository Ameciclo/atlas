import { eq, and, gte, lte } from "drizzle-orm";
import type { AppRouteHandler } from "../../lib/types.js";
import { db } from "../../db/index.js";
import { trafficViolations } from "../../db/schema.js";
import type { listViolationsRoute, getViolationRoute } from "./violations.routes.js";

// ============================================================================
// Handlers
// ============================================================================

export const listViolationsHandler: AppRouteHandler<typeof listViolationsRoute> = async (c) => {
	const {
		start_date,
		end_date,
		agent_id,
		violation_type_id,
		location_id,
		limit = 10,
		offset = 0,
	} = c.req.valid("query");

	const conditions = [];

	if (start_date) {
		conditions.push(
			gte(trafficViolations.violation_date, new Date(start_date)),
		);
	}

	if (end_date) {
		conditions.push(
			lte(trafficViolations.violation_date, new Date(end_date)),
		);
	}

	if (agent_id) {
		conditions.push(eq(trafficViolations.agent_id, agent_id));
	}

	if (violation_type_id) {
		conditions.push(
			eq(trafficViolations.violation_type_id, violation_type_id),
		);
	}

	if (location_id) {
		conditions.push(eq(trafficViolations.location_id, location_id));
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	const violations = await db
		.select()
		.from(trafficViolations)
		.where(whereClause)
		.orderBy(trafficViolations.violation_date)
		.limit(limit)
		.offset(offset);

	return c.json(violations, 200);
};

export const getViolationHandler: AppRouteHandler<typeof getViolationRoute> = async (c) => {
	const { id } = c.req.valid("param");

	const violation = await db
		.select()
		.from(trafficViolations)
		.where(eq(trafficViolations.id, Number(id)))
		.limit(1);

	if (violation.length === 0) {
		return c.json({ error: "Traffic violation not found" }, 404);
	}

	return c.json(violation[0], 200);
};
