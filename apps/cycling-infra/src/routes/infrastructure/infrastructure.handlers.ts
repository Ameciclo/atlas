import { eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { createConnectedDatabase } from "@atlas/database";
import { ciclomapaInfra } from "@atlas/database/schemas/cycling-infra";
import type { AppRouteHandler } from "../../lib/types.js";
import type { ListRoute, GetByIdRoute, GetGeoJSONRoute, GetNearbyRoute } from "./infrastructure.routes.js";

export const list = async (c: any) => {
	try {
		const { type, limit } = c.req.valid("query");
		const db = await createConnectedDatabase();

		const limitNum = limit ? parseInt(limit, 10) : 100;
		const validLimit = !Number.isNaN(limitNum) && limitNum > 0 ? limitNum : 100;

		let infrastructure: any[];

		if (type) {
			infrastructure = await db
				.select()
				.from(ciclomapaInfra)
				.where(eq(ciclomapaInfra.infra_type, type))
				.limit(validLimit);
		} else {
			infrastructure = await db.select().from(ciclomapaInfra).limit(validLimit);
		}

		return c.json(infrastructure as any, HttpStatusCodes.OK);
	} catch (error) {
		return c.json({ error: "Internal server error" } as any, HttpStatusCodes.INTERNAL_SERVER_ERROR);
	}
};

export const getById = async (c: any) => {
	try {
		const { id } = c.req.valid("param");
		const db = await createConnectedDatabase();

		const infrastructure = await db
			.select()
			.from(ciclomapaInfra)
			.where(eq(ciclomapaInfra.id, id));

		if (infrastructure.length === 0) {
			return c.json({ message: "Infrastructure not found" } as any, HttpStatusCodes.NOT_FOUND);
		}

		return c.json(infrastructure[0] as any, HttpStatusCodes.OK);
	} catch (error) {
		return c.json({ message: "Internal Server Error" } as any, HttpStatusCodes.INTERNAL_SERVER_ERROR);
	}
};

export const getGeoJSON = async (c: any) => {
	try {
		const { type, limit } = c.req.valid("query");
		const db = await createConnectedDatabase();

		const limitNum = limit ? parseInt(limit, 10) : 100;
		const validLimit = !Number.isNaN(limitNum) && limitNum > 0 ? limitNum : 100;

		let infrastructure: any[];

		if (type) {
			infrastructure = await db
				.select()
				.from(ciclomapaInfra)
				.where(eq(ciclomapaInfra.infra_type, type))
				.limit(validLimit);
		} else {
			infrastructure = await db.select().from(ciclomapaInfra).limit(validLimit);
		}

		const features = infrastructure.map(infra => ({
			type: "Feature" as const,
			id: String(infra.osm_id),
			geometry: infra.geojson?.geometry || null,
			properties: {
				id: infra.id,
				osm_id: infra.osm_id,
				name: infra.name,
				infra_type: infra.infra_type,
				created_at: infra.created_at,
				updated_at: infra.updated_at,
			} as Record<string, any>,
		}));

		return c.json({
			type: "FeatureCollection" as const,
			features,
		} as any, HttpStatusCodes.OK);
	} catch (error) {
		return c.json({ error: "Internal server error" } as any, HttpStatusCodes.INTERNAL_SERVER_ERROR);
	}
};

export const getNearby = async (c: any) => {
	try {
		const { lat, lon, radius = "1000", type } = c.req.valid("query");
		const db = await createConnectedDatabase();
		
		const latitude = parseFloat(lat);
		const longitude = parseFloat(lon);
		const radiusMeters = parseInt(radius, 10);
		
		// Query existing cycling infrastructure within radius using PostGIS
		let query = `
			SELECT 
				ci.id,
				ci.osm_id,
				ci.name,
				ci.infra_type,
				ci.geojson,
				ST_Distance(
					ci.coordinates::geography,
					ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
				) as distance_meters
			FROM ciclomapa_infra ci
			WHERE ST_DWithin(
				ci.coordinates::geography,
				ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
				${radiusMeters}
			)
			AND ci.coordinates IS NOT NULL
		`;
		
		if (type) {
			query += ` AND ci.infra_type = '${type}'`;
		}
		
		query += ` ORDER BY distance_meters`;
		
		const result = await db.execute(query);
		const infrastructure = result.rows as any[];
		
		// Convert to GeoJSON features
		const features = infrastructure.map(infra => ({
			type: "Feature" as const,
			id: String(infra.osm_id),
			properties: {
				id: infra.id,
				osm_id: infra.osm_id,
				name: infra.name,
				infra_type: infra.infra_type,
				distance_meters: Math.round(infra.distance_meters || 0),
			} as Record<string, any> & { name: string | null; infra_type: string; distance_meters: number },
			geometry: infra.geojson?.geometry || null,
		}));
		
		// Calculate summary by type
		const byType: Record<string, number> = {};
		features.forEach(f => {
			const infraType = f.properties.infra_type;
			byType[infraType] = (byType[infraType] || 0) + 1;
		});
		
		return c.json({
			type: "FeatureCollection" as const,
			features,
			summary: {
				total_infrastructure: features.length,
				by_type: byType,
			},
		} as any);
	} catch (error) {
		console.error('Error in getNearby:', error);
		return c.json({ error: "Internal server error" } as any, 500);
	}
};
