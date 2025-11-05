import type { Context } from "hono";
import { and, eq, gte, lte, ilike } from "@atlas/database";
import { db } from "../../db/index.js";
import { sharedBikeStations } from "@atlas/database";

export async function listStations(c: Context) {
	const { network, operator, min_capacity, max_capacity } = c.req.query();

	const conditions = [];

	if (network) {
		conditions.push(ilike(sharedBikeStations.network, `%${network}%`));
	}

	if (operator) {
		conditions.push(ilike(sharedBikeStations.operator, `%${operator}%`));
	}

	if (min_capacity) {
		const minCap = Number.parseInt(min_capacity, 10);
		if (!Number.isNaN(minCap)) {
			conditions.push(gte(sharedBikeStations.capacity, minCap));
		}
	}

	if (max_capacity) {
		const maxCap = Number.parseInt(max_capacity, 10);
		if (!Number.isNaN(maxCap)) {
			conditions.push(lte(sharedBikeStations.capacity, maxCap));
		}
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	const stations = await db
		.select()
		.from(sharedBikeStations)
		.where(whereClause)
		.orderBy(sharedBikeStations.name);

	return c.json(stations);
}

export async function getStation(c: Context) {
	const id = c.req.param("id");
	const stationId = Number.parseInt(id, 10);

	if (Number.isNaN(stationId)) {
		return c.json({ error: "Invalid station ID" }, 400);
	}

	const station = await db
		.select()
		.from(sharedBikeStations)
		.where(eq(sharedBikeStations.id, stationId))
		.limit(1);

	if (station.length === 0) {
		return c.json({ error: "Station not found" }, 404);
	}

	return c.json(station[0]);
}
