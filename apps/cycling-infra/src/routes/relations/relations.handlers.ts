import { eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";
import { createConnectedDatabase } from "@atlas/database";
import { pdcRelationWays, cyclistInfraRelations } from "@atlas/database/schemas/cycling-infra";
import type { AppRouteHandler } from "../../lib/types.js";
import type { GetWaysByRelationIdRoute, ListRoute } from "./relations.routes.js";

export const list: AppRouteHandler<ListRoute> = async (c) => {
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

export const getWaysByRelationId: AppRouteHandler<GetWaysByRelationIdRoute> = async (c) => {
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