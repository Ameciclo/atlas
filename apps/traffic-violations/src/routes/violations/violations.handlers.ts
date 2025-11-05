import { eq, and, gte, lte, count, desc, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { trafficViolations } from "../../db/schema.js";
import type { AppRouteHandler } from "../../lib/types.js";
import type {
	listViolationsRoute,
	getViolationRoute,
	ViolationsByLocationRoute,
	ViolationsHotspotsRoute,
	ViolationsGeoJSONRoute,
} from "./violations.routes.js";

// ============================================================================
// Handlers
// ============================================================================

export const listViolationsHandler: AppRouteHandler<
	typeof listViolationsRoute
> = async (c) => {
	const {
		start_date,
		end_date,
		agent_id,
		violation_type_id,
		location_id,
		limit = 10,
		offset = 0,
	} = c.req.valid("query");

	const conditions: any[] = [];

	try {
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

export const violationsByLocationHandler: AppRouteHandler<ViolationsByLocationRoute> = async (c) => {
	const { start_date, end_date, limit = 50 } = c.req.valid("query");

	try {
		// Build date conditions
		const conditions: any[] = [];
		if (start_date) {
			conditions.push(gte(trafficViolations.violation_date, new Date(start_date)));
		}
		if (end_date) {
			conditions.push(lte(trafficViolations.violation_date, new Date(end_date)));
		}

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
				trafficViolations.coordinates
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

export const violationsHotspotsHandler: AppRouteHandler<ViolationsHotspotsRoute> = async (c) => {
	const { violation_type_id, limit = 50, radius_km = 1 } = c.req.valid("query");

	try {
		// Build conditions
		const conditions: any[] = [];
		if (violation_type_id) {
			conditions.push(eq(trafficViolations.violation_type_id, violation_type_id));
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		// Get violations with coordinates (mock clustering)
		const violationsData = await db
			.select({
				location_description: trafficViolations.location_description,
				coordinates: trafficViolations.coordinates,
				description: trafficViolations.description,
				count: count(),
			})
			.from(trafficViolations)
			.where(whereClause)
			.groupBy(
				trafficViolations.location_description,
				trafficViolations.coordinates,
				trafficViolations.description
			)
			.orderBy(desc(count()))
			.limit(limit);

		// Create mock hotspots (in real implementation, would use spatial clustering)
		const features = violationsData
			.filter(v => v.coordinates)
			.map(violation => {
				// Parse coordinates (assuming format like "-8.0476,-34.8813")
				const coords = violation.coordinates?.split(',').map(Number) || [-34.8813, -8.0476];
				return {
					type: "Feature" as const,
					geometry: {
						type: "Point" as const,
						coordinates: [coords[1] || -34.8813, coords[0] || -8.0476], // [lng, lat]
					},
					properties: {
						violations_count: violation.count,
						radius_km: radius_km,
						violation_types: [violation.description],
					},
				};
			});

		return c.json({
			type: "FeatureCollection" as const,
			features,
		}, 200) as any;
	} catch (error) {
		console.error("Error fetching violation hotspots:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};

export const violationsGeoJSONHandler: AppRouteHandler<ViolationsGeoJSONRoute> = async (c) => {
	const { start_date, end_date, violation_type_id, agent_id, limit = 100 } = c.req.valid("query");

	try {
		// Build conditions
		const conditions: any[] = [];
		if (start_date) {
			conditions.push(gte(trafficViolations.violation_date, new Date(start_date)));
		}
		if (end_date) {
			conditions.push(lte(trafficViolations.violation_date, new Date(end_date)));
		}
		if (violation_type_id) {
			conditions.push(eq(trafficViolations.violation_type_id, violation_type_id));
		}
		if (agent_id) {
			conditions.push(eq(trafficViolations.agent_id, agent_id));
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		// Get violations with coordinates
		const violations = await db
			.select({
				id: trafficViolations.id,
				violation_date: trafficViolations.violation_date,
				description: trafficViolations.description,
				agent_id: trafficViolations.agent_id,
				coordinates: trafficViolations.coordinates,
				violation_type_id: trafficViolations.violation_type_id,
			})
			.from(trafficViolations)
			.where(whereClause)
			.orderBy(desc(trafficViolations.violation_date))
			.limit(limit);

		// Create GeoJSON features
		const features = violations
			.filter(v => v.coordinates)
			.map(violation => {
				// Parse coordinates (assuming format like "-8.0476,-34.8813")
				const coords = violation.coordinates?.split(',').map(Number) || [-34.8813, -8.0476];
				return {
					type: "Feature" as const,
					geometry: {
						type: "Point" as const,
						coordinates: [coords[1] || -34.8813, coords[0] || -8.0476], // [lng, lat]
					},
					properties: {
						violation_type: `Type ${violation.violation_type_id}`,
						agent_id: violation.agent_id,
						date: violation.violation_date?.toISOString().split('T')[0] || '',
						description: violation.description,
					},
				};
			});

		return c.json({
			type: "FeatureCollection" as const,
			features,
		}, 200) as any;
	} catch (error) {
		console.error("Error fetching violations GeoJSON:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};
