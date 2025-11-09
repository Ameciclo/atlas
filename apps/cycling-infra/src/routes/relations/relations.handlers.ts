import { eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { createConnectedDatabase } from "@atlas/database";
import {
	pdcRelationWays,
	cyclistInfraRelations,
} from "@atlas/database/schemas/cycling-infra";

export const list = async (c: any) => {
	try {
		const db = await createConnectedDatabase();
		const relations = await db.select().from(cyclistInfraRelations);
		return c.json(relations, HttpStatusCodes.OK);
	} catch (error) {
		console.error("Error fetching relations:", error);
		return c.json(
			{ message: "Internal Server Error" },
			HttpStatusCodes.INTERNAL_SERVER_ERROR,
		);
	}
};

export const getById = async (c: any) => {
	const { id } = c.req.valid("param");

	try {
		const db = await createConnectedDatabase();

		// Find relation by OSM ID only
		const relation = await db
			.select()
			.from(cyclistInfraRelations)
			.where(eq(cyclistInfraRelations.osm_id, String(id)))
			.limit(1);

		if (relation.length === 0) {
			return c.json(
				{ message: "Relation not found" },
				HttpStatusCodes.NOT_FOUND,
			);
		}

		// Get ways for this relation using relation_id
		const relationWays = await db
			.select()
			.from(pdcRelationWays)
			.where(eq(pdcRelationWays.relation_id, relation[0]?.id || 0));

		if (relationWays.length === 0) {
			return c.json(
				{
					type: "FeatureCollection" as const,
					features: [],
				},
				HttpStatusCodes.OK,
			);
		}

		// Convert to GeoJSON FeatureCollection
		const features = relationWays.map((way) => ({
			type: "Feature" as const,
			id: `relation/${relation[0]?.osm_id}`,
			properties: {
				...(way.osm_properties as Record<string, any>),
				name: relation[0]?.name,
				ref: relation[0]?.pdc_ref,
				description: relation[0]?.pdc_stretch,
				pdc_typology: relation[0]?.pdc_typology,
			},
			geometry: (way.geojson as any)?.geometry || null,
		}));

		return c.json(
			{
				type: "FeatureCollection" as const,
				features,
			},
			HttpStatusCodes.OK,
		);
	} catch (error) {
		console.error(`Error fetching relation ${id}:`, error);
		return c.json(
			{ message: "Internal Server Error" },
			HttpStatusCodes.INTERNAL_SERVER_ERROR,
		);
	}
};

export const getWaysByRelationId = async (c: any) => {
	const { id } = c.req.valid("param");

	try {
		const db = await createConnectedDatabase();

		// Find the relation by OSM ID
		const relation = await db
			.select()
			.from(cyclistInfraRelations)
			.where(eq(cyclistInfraRelations.osm_id, id.toString()))
			.limit(1);

		if (relation.length === 0) {
			return c.json(
				{ message: "Relation not found" },
				HttpStatusCodes.NOT_FOUND,
			);
		}

		// Get ways using relation/osmId format
		const relationOsmId = `relation/${id}`;
		const relationWays = await db
			.select()
			.from(pdcRelationWays)
			.where(eq(pdcRelationWays.osm_id, relationOsmId));

		return c.json(relationWays, HttpStatusCodes.OK);
	} catch (error) {
		console.error(`Error fetching relation ways for ID ${id}:`, error);
		return c.json(
			{ message: "Internal Server Error" },
			HttpStatusCodes.INTERNAL_SERVER_ERROR,
		);
	}
};
