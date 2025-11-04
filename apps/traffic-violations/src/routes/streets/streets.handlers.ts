import { and, count, eq, ilike } from "drizzle-orm";
import { db } from "../../db/index.js";
import { officialStreets } from "../../db/schema.js";
import type { AppRouteHandler } from "../../lib/types.js";
import type { listStreetsRoute, getStreetRoute } from "./streets.routes.js";

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
