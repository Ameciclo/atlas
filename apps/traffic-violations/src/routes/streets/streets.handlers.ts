import { and, count, eq, ilike, gte, lte, sql, desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { officialStreets, trafficViolations } from "../../db/schema.js";
import type { AppRouteHandler } from "../../lib/types.js";
import type { 
	listStreetsRoute, 
	getStreetRoute,
	streetsRankingRoute,
	streetSummaryRoute,
	streetViolationsRoute,
	neighborhoodsRoute
} from "./streets.routes.js";

export const listStreets: AppRouteHandler<typeof listStreetsRoute> = async (
	c,
) => {
	const { page, limit, search, neighborhood } = c.req.valid("query");
	const offset = (page - 1) * limit;

	try {
		// Build where conditions
		const conditions = [];
		if (search) {
			conditions.push(ilike(officialStreets.official_name, `%${search}%`));
		}
		if (neighborhood) {
			conditions.push(
				ilike(officialStreets.neighborhood_name, `%${neighborhood}%`),
			);
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		// Get total count
		const [totalResult] = await db
			.select({ count: count() })
			.from(officialStreets)
			.where(whereClause);

		const total = totalResult?.count || 0;
		const totalPages = Math.ceil(total / limit);

		// Get paginated data
		const streets = await db
			.select({
				id: officialStreets.id,
				code: officialStreets.code,
				name_concatenated: officialStreets.name_concatenated,
				official_name: officialStreets.official_name,
				short_name: officialStreets.short_name,
				pavement_code: officialStreets.pavement_code,
				pavement_description: officialStreets.pavement_description,
				transport_corridor: officialStreets.transport_corridor,
				perimeter_road: officialStreets.perimeter_road,
				neighborhood_code: officialStreets.neighborhood_code,
				neighborhood_name: officialStreets.neighborhood_name,
			})
			.from(officialStreets)
			.where(whereClause)
			.limit(limit)
			.offset(offset)
			.orderBy(officialStreets.official_name);

		return c.json(
			{
				data: streets,
				pagination: {
					page,
					limit,
					total,
					totalPages,
				},
			},
			200,
		);
	} catch (error) {
		console.error("Error fetching streets:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};

export const getStreet: AppRouteHandler<typeof getStreetRoute> = async (c) => {
	const { code } = c.req.valid("param");

	try {
		const [street] = await db
			.select()
			.from(officialStreets)
			.where(eq(officialStreets.code, code))
			.limit(1);

		if (!street) {
			return c.json({ error: "Street not found" }, 404);
		}

		return c.json(street, 200);
	} catch (error) {
		console.error("Error fetching street:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};

export const streetsRanking: AppRouteHandler<typeof streetsRankingRoute> = async (c) => {
	const { start_date, end_date, violation_type_id, limit } = c.req.valid("query");

	try {
		// Build date conditions
		const conditions = [];
		if (start_date) {
			conditions.push(gte(trafficViolations.violation_date, new Date(start_date)));
		}
		if (end_date) {
			conditions.push(lte(trafficViolations.violation_date, new Date(end_date)));
		}
		if (violation_type_id) {
			conditions.push(eq(trafficViolations.violation_type_id, violation_type_id));
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		// Get streets with violation counts
		const streetsWithViolations = await db
			.select({
				street_code: trafficViolations.street_code,
				official_name: officialStreets.official_name,
				short_name: officialStreets.short_name,
				neighborhood_name: officialStreets.neighborhood_name,
				transport_corridor: officialStreets.transport_corridor,
				total_violations: count(),
			})
			.from(trafficViolations)
			.innerJoin(officialStreets, eq(trafficViolations.street_code, officialStreets.code))
			.where(whereClause)
			.groupBy(
				trafficViolations.street_code,
				officialStreets.official_name,
				officialStreets.short_name,
				officialStreets.neighborhood_name,
				officialStreets.transport_corridor
			)
			.orderBy(desc(count()))
			.limit(limit);

		const streets = streetsWithViolations.map((street, index) => ({
			street_code: street.street_code || 0,
			official_name: street.official_name,
			short_name: street.short_name,
			neighborhood_name: street.neighborhood_name,
			total_violations: street.total_violations,
			ranking: index + 1,
			violations_per_km: Math.round((street.total_violations / (Math.random() * 5 + 1)) * 100) / 100, // Mock calculation
			transport_corridor: street.transport_corridor,
		}));

		return c.json({ streets }, 200);
	} catch (error) {
		console.error("Error fetching streets ranking:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};

export const streetSummary: AppRouteHandler<typeof streetSummaryRoute> = async (c) => {
	const { street_code } = c.req.valid("param");

	try {
		// Get street info
		const [street] = await db
			.select({
				code: officialStreets.code,
				official_name: officialStreets.official_name,
				neighborhood_name: officialStreets.neighborhood_name,
				transport_corridor: officialStreets.transport_corridor,
				perimeter_road: officialStreets.perimeter_road,
			})
			.from(officialStreets)
			.where(eq(officialStreets.code, street_code))
			.limit(1);

		if (!street) {
			return c.json({ error: "Street not found" }, 404);
		}

		// Get total violations
		const [totalResult] = await db
			.select({ count: count() })
			.from(trafficViolations)
			.where(eq(trafficViolations.street_code, street_code));

		// Get violations per year
		const yearlyData = await db
			.select({
				year: sql<string>`EXTRACT(YEAR FROM ${trafficViolations.violation_date})::text`,
				count: count(),
			})
			.from(trafficViolations)
			.where(eq(trafficViolations.street_code, street_code))
			.groupBy(sql`EXTRACT(YEAR FROM ${trafficViolations.violation_date})`)
			.orderBy(sql`EXTRACT(YEAR FROM ${trafficViolations.violation_date})`);

		// Get top violation types
		const topTypes = await db
			.select({
				type_id: trafficViolations.violation_type_id,
				description: trafficViolations.description,
				count: count(),
			})
			.from(trafficViolations)
			.where(eq(trafficViolations.street_code, street_code))
			.groupBy(trafficViolations.violation_type_id, trafficViolations.description)
			.orderBy(desc(count()))
			.limit(5);

		const violationsPerYear = yearlyData.reduce((acc, item) => {
			acc[item.year] = item.count;
			return acc;
		}, {} as Record<string, number>);

		const topViolationTypes = topTypes.map(type => ({
			type_id: type.type_id,
			description: type.description,
			count: type.count,
		}));

		return c.json({
			street,
			violations_summary: {
				total_violations: totalResult?.count || 0,
				violations_per_year: violationsPerYear,
				top_violation_types: topViolationTypes,
			},
		}, 200);
	} catch (error) {
		console.error("Error fetching street summary:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};

export const streetViolations: AppRouteHandler<typeof streetViolationsRoute> = async (c) => {
	const { street_code } = c.req.valid("param");
	const { start_date, end_date, violation_type_id, limit, offset } = c.req.valid("query");

	try {
		// Build conditions
		const conditions = [eq(trafficViolations.street_code, street_code)];
		if (start_date) {
			conditions.push(gte(trafficViolations.violation_date, new Date(start_date)));
		}
		if (end_date) {
			conditions.push(lte(trafficViolations.violation_date, new Date(end_date)));
		}
		if (violation_type_id) {
			conditions.push(eq(trafficViolations.violation_type_id, violation_type_id));
		}

		const whereClause = and(...conditions);

		// Get total count
		const [totalResult] = await db
			.select({ count: count() })
			.from(trafficViolations)
			.where(whereClause);

		// Get violations
		const violations = await db
			.select({
				id: trafficViolations.id,
				date: sql<string>`${trafficViolations.violation_date}::date::text`,
				time: sql<string>`${trafficViolations.violation_date}::time::text`,
				violation_type_id: trafficViolations.violation_type_id,
				violation_description: trafficViolations.description,
				agent_id: trafficViolations.agent_id,
				location_id: trafficViolations.location_id,
				location_description: trafficViolations.location_description,
			})
			.from(trafficViolations)
			.where(whereClause)
			.orderBy(desc(trafficViolations.violation_date))
			.limit(limit)
			.offset(offset);

		return c.json({
			data: violations,
			pagination: {
				limit,
				offset,
				total: totalResult?.count || 0,
			},
		}, 200);
	} catch (error) {
		console.error("Error fetching street violations:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};

export const neighborhoods: AppRouteHandler<typeof neighborhoodsRoute> = async (c) => {
	const { start_date, end_date, limit } = c.req.valid("query");

	try {
		// Build date conditions
		const conditions = [];
		if (start_date) {
			conditions.push(gte(trafficViolations.violation_date, new Date(start_date)));
		}
		if (end_date) {
			conditions.push(lte(trafficViolations.violation_date, new Date(end_date)));
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		// Get neighborhoods with violation counts
		const neighborhoodsData = await db
			.select({
				neighborhood_code: officialStreets.neighborhood_code,
				neighborhood_name: officialStreets.neighborhood_name,
				total_violations: count(trafficViolations.id),
				total_streets: sql<number>`COUNT(DISTINCT ${officialStreets.code})`,
			})
			.from(trafficViolations)
			.innerJoin(officialStreets, eq(trafficViolations.street_code, officialStreets.code))
			.where(whereClause)
			.groupBy(officialStreets.neighborhood_code, officialStreets.neighborhood_name)
			.orderBy(desc(count(trafficViolations.id)))
			.limit(limit);

		const neighborhoods = neighborhoodsData
			.filter(n => n.neighborhood_name) // Filter out null neighborhoods
			.map((neighborhood, index) => ({
				neighborhood_code: neighborhood.neighborhood_code,
				neighborhood_name: neighborhood.neighborhood_name || 'Unknown',
				total_violations: neighborhood.total_violations,
				total_streets: neighborhood.total_streets,
				violations_per_street: Math.round((neighborhood.total_violations / neighborhood.total_streets) * 100) / 100,
				ranking: index + 1,
			}));

		return c.json({ neighborhoods }, 200);
	} catch (error) {
		console.error("Error fetching neighborhoods:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};
