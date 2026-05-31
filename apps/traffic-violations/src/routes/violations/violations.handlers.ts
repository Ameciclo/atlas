import { and, count, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "../../db/index.js";
import { trafficViolations } from "../../db/schema.js";
import type { AppRouteHandler } from "../../lib/types.js";
import type {
	getViolationRoute,
	listViolationsRoute,
	ViolationsByLocationRoute,
} from "./violations.routes.js";

// ============================================================================
// Handlers
// ============================================================================

export const listViolationsHandler: AppRouteHandler<
	typeof listViolationsRoute
> = async (c) => {
	const {
		month,
		year,
		agent_id,
		violation_type_id,
		location_id,
		limit = 10,
		offset = 0,
	} = c.req.valid("query");

	const conditions: any[] = [];

	try {
		// Primeiro dia do mês
		const startOfMonth = new Date(year, month - 1, 1);
		// Último dia do mês
		const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

		conditions.push(
			gte(trafficViolations.violation_date, startOfMonth),
			lte(trafficViolations.violation_date, endOfMonth),
		);

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
	} catch (error) {
		console.error("Error fetching violations:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};

export const getViolationHandler: AppRouteHandler<
	typeof getViolationRoute
> = async (c) => {
	const { id } = c.req.valid("param");

	try {
		const violation = await db
			.select()
			.from(trafficViolations)
			.where(eq(trafficViolations.id, id))
			.limit(1);

		if (violation.length === 0) {
			return c.json({ error: "Traffic violation not found" }, 404);
		}

		return c.json(violation[0], 200);
	} catch (error) {
		console.error("Error fetching violation:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};

export const violationsByLocationHandler: AppRouteHandler<
	ViolationsByLocationRoute
> = async (c) => {
	const { month, year, limit = 50 } = c.req.valid("query");

	try {
		// Build date conditions
		const conditions: any[] = [];

		// Primeiro dia do mês
		const startOfMonth = new Date(year, month - 1, 1);
		// Último dia do mês
		const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

		conditions.push(
			gte(trafficViolations.violation_date, startOfMonth),
			lte(trafficViolations.violation_date, endOfMonth),
		);

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		// Get locations with violation counts
		const locationsData = await db
			.select({
				location_id: trafficViolations.location_id,
				location_description: trafficViolations.location_description,
				coordinates: trafficViolations.coordinates,
				total_violations: count(),
			})
			.from(trafficViolations)
			.where(whereClause)
			.groupBy(
				trafficViolations.location_id,
				trafficViolations.location_description,
				trafficViolations.coordinates,
			)
			.orderBy(desc(count()))
			.limit(limit);

		const locations = locationsData.map((location, index) => ({
			location_id: location.location_id,
			location_description: location.location_description,
			total_violations: location.total_violations,
			ranking: index + 1,
			coordinates: location.coordinates,
		}));

		return c.json({ locations }, 200) as any;
	} catch (error) {
		console.error("Error fetching violations by location:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};
