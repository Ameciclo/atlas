import { eq, and, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { AppRouteHandler } from "../lib/types.js";
import { db } from "../db/index.js";
import { bicycleRacks, bicycleRackCities } from "@atlas/database/schemas/bicycle-racks";
import type {
	ListRoute,
	GetByIdRoute,
	NearbyRoute,
	StatsRoute,
	GeoJsonRoute,
} from "./bicycle-racks.routes.js";

export const list: AppRouteHandler<ListRoute> = async (c) => {
	const { covered, access, capacity_min, capacity_max, operator, city } =
		c.req.valid("query");

	const conditions = [];
	if (covered) conditions.push(eq(bicycleRacks.covered, covered));
	if (access) conditions.push(eq(bicycleRacks.access, access));
	if (operator) conditions.push(eq(bicycleRacks.operator, operator));
	if (capacity_min)
		conditions.push(
			sql`${bicycleRacks.capacity} ~ '^[0-9]+$' AND CAST(${bicycleRacks.capacity} AS INTEGER) >= ${capacity_min}`,
		);
	if (capacity_max)
		conditions.push(
			sql`${bicycleRacks.capacity} ~ '^[0-9]+$' AND CAST(${bicycleRacks.capacity} AS INTEGER) <= ${capacity_max}`,
		);

	if (city) {
		conditions.push(eq(bicycleRackCities.city, city));
		const racks = await db
			.select()
			.from(bicycleRacks)
			.innerJoin(bicycleRackCities, eq(bicycleRacks.osm_id, bicycleRackCities.osm_id))
			.where(conditions.length > 0 ? and(...conditions) : undefined);
		return c.json(racks.map(item => item.bicycle_racks), HttpStatusCodes.OK);
	} else {
		const racks = await db
			.select()
			.from(bicycleRacks)
			.where(conditions.length > 0 ? and(...conditions) : undefined);
		return c.json(racks, HttpStatusCodes.OK);
	}
};

export const getById: AppRouteHandler<GetByIdRoute> = async (c) => {
	const { id } = c.req.valid("param");

	const rack = await db
		.select()
		.from(bicycleRacks)
		.where(eq(bicycleRacks.id, id))
		.limit(1);

	if (rack.length === 0) {
		return c.json(
			{ message: "Bicycle rack not found" },
			HttpStatusCodes.NOT_FOUND,
		);
	}

	return c.json(rack[0], HttpStatusCodes.OK);
};

export const nearby: AppRouteHandler<NearbyRoute> = async (c) => {
	const { lat, lng, radius, city } = c.req.valid("query");

	if (city) {
		const racks = await db.execute(sql`
			SELECT br.*, 
				ST_Distance(
					br.coordinates::geography, 
					ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
				) as distance
			FROM bicycle_racks br
			INNER JOIN bicycle_rack_cities brc ON br.osm_id = brc.osm_id
			WHERE br.coordinates IS NOT NULL
				AND brc.city = ${city}
				AND ST_Distance(
					br.coordinates::geography, 
					ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
				) <= ${radius}
			ORDER BY distance
		`);
		return c.json(racks.rows as any, HttpStatusCodes.OK);
	} else {
		const racks = await db.execute(sql`
			SELECT *, 
				ST_Distance(
					coordinates::geography, 
					ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
				) as distance
			FROM bicycle_racks 
			WHERE coordinates IS NOT NULL
				AND ST_Distance(
					coordinates::geography, 
					ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
				) <= ${radius}
			ORDER BY distance
		`);
		return c.json(racks.rows as any, HttpStatusCodes.OK);
	}
};

export const stats: AppRouteHandler<StatsRoute> = async (c) => {
	const { city } = c.req.valid("query");

	if (city) {
		const totalResult = await db.execute(
			sql`SELECT COUNT(*) as total FROM bicycle_racks br INNER JOIN bicycle_rack_cities brc ON br.osm_id = brc.osm_id WHERE brc.city = ${city}`,
		);
		const coveredResult = await db.execute(
			sql`SELECT COUNT(*) as covered FROM bicycle_racks br INNER JOIN bicycle_rack_cities brc ON br.osm_id = brc.osm_id WHERE br.covered = 'yes' AND brc.city = ${city}`,
		);
		const publicResult = await db.execute(
			sql`SELECT COUNT(*) as public_access FROM bicycle_racks br INNER JOIN bicycle_rack_cities brc ON br.osm_id = brc.osm_id WHERE br.access = 'yes' AND brc.city = ${city}`,
		);
		const avgCapacityResult = await db.execute(
			sql`SELECT COALESCE(AVG(CAST(br.capacity AS INTEGER)), 0) as avg_capacity FROM bicycle_racks br INNER JOIN bicycle_rack_cities brc ON br.osm_id = brc.osm_id WHERE br.capacity ~ '^[0-9]+$' AND brc.city = ${city}`,
		);
		const operatorStats = await db.execute(
			sql`SELECT br.operator, COUNT(*) as count FROM bicycle_racks br INNER JOIN bicycle_rack_cities brc ON br.osm_id = brc.osm_id WHERE br.operator IS NOT NULL AND brc.city = ${city} GROUP BY br.operator`,
		);

		const byOperator: Record<string, number> = {};
		for (const row of operatorStats.rows) {
			byOperator[row.operator as string] = Number(row.count);
		}

		return c.json(
			{
				total: Number(totalResult.rows[0].total),
				covered: Number(coveredResult.rows[0].covered),
				public_access: Number(publicResult.rows[0].public_access),
				avg_capacity: Number(avgCapacityResult.rows[0].avg_capacity) || 0,
				by_operator: byOperator,
			},
			HttpStatusCodes.OK,
		);
	} else {
		const totalResult = await db.execute(
			sql`SELECT COUNT(*) as total FROM bicycle_racks`,
		);
		const coveredResult = await db.execute(
			sql`SELECT COUNT(*) as covered FROM bicycle_racks WHERE covered = 'yes'`,
		);
		const publicResult = await db.execute(
			sql`SELECT COUNT(*) as public_access FROM bicycle_racks WHERE access = 'yes'`,
		);
		const avgCapacityResult = await db.execute(
			sql`SELECT COALESCE(AVG(CAST(capacity AS INTEGER)), 0) as avg_capacity FROM bicycle_racks WHERE capacity ~ '^[0-9]+$'`,
		);
		const operatorStats = await db.execute(
			sql`SELECT operator, COUNT(*) as count FROM bicycle_racks WHERE operator IS NOT NULL GROUP BY operator`,
		);

		const byOperator: Record<string, number> = {};
		for (const row of operatorStats.rows) {
			byOperator[row.operator as string] = Number(row.count);
		}

		return c.json(
			{
				total: Number(totalResult.rows[0].total),
				covered: Number(coveredResult.rows[0].covered),
				public_access: Number(publicResult.rows[0].public_access),
				avg_capacity: Number(avgCapacityResult.rows[0].avg_capacity) || 0,
				by_operator: byOperator,
			},
			HttpStatusCodes.OK,
		);
	}
};

export const geojson: AppRouteHandler<GeoJsonRoute> = async (c) => {
	const { city } = c.req.valid("query");

	if (city) {
		const racks = await db.execute(sql`
			SELECT br.*, 
				ST_X(br.coordinates) as longitude,
				ST_Y(br.coordinates) as latitude
			FROM bicycle_racks br
			INNER JOIN bicycle_rack_cities brc ON br.osm_id = brc.osm_id
			WHERE br.coordinates IS NOT NULL
				AND brc.city = ${city}
		`);

		const features = racks.rows.map((rack) => ({
			type: "Feature" as const,
			properties: {
				id: rack.id,
				name: rack.name,
				capacity: rack.capacity,
				covered: rack.covered,
				access: rack.access,
				operator: rack.operator,
				bicycle_parking: rack.bicycle_parking,
			},
			geometry: {
				type: "Point" as const,
				coordinates: [Number(rack.longitude), Number(rack.latitude)],
			},
		}));

		return c.json(
			{
				type: "FeatureCollection",
				features,
			},
			HttpStatusCodes.OK,
		);
	} else {
		const racks = await db.execute(sql`
			SELECT *, 
				ST_X(coordinates) as longitude,
				ST_Y(coordinates) as latitude
			FROM bicycle_racks 
			WHERE coordinates IS NOT NULL
		`);

		const features = racks.rows.map((rack) => ({
			type: "Feature" as const,
			properties: {
				id: rack.id,
				name: rack.name,
				capacity: rack.capacity,
				covered: rack.covered,
				access: rack.access,
				operator: rack.operator,
				bicycle_parking: rack.bicycle_parking,
			},
			geometry: {
				type: "Point" as const,
				coordinates: [Number(rack.longitude), Number(rack.latitude)],
			},
		}));

		return c.json(
			{
				type: "FeatureCollection",
				features,
			},
			HttpStatusCodes.OK,
		);
	}
};
