import { eq } from "drizzle-orm";
import { createConnectedDatabase } from "@atlas/database";
import {
	cities,
	cyclistInfraRelations,
	cyclistInfraRelationCities,
} from "@atlas/database/schemas/cycling-infra";
import type { AppRouteHandler } from "../../lib/types.js";
import type { RelationsByCityRoute } from "./relations-by-city.routes.js";

export const relationsByCity: AppRouteHandler<RelationsByCityRoute> = async (
	c,
) => {
	const db = await createConnectedDatabase();

	const result = await db
		.select({
			city_id: cities.id,
			name: cities.name,
			state: cities.state,
			relation_id: cyclistInfraRelations.id,
			pdc_ref: cyclistInfraRelations.pdc_ref,
			relation_name: cyclistInfraRelations.name,
			pdc_typology: cyclistInfraRelations.pdc_typology,
		})
		.from(cities)
		.innerJoin(
			cyclistInfraRelationCities,
			eq(cities.id, cyclistInfraRelationCities.city_id),
		)
		.innerJoin(
			cyclistInfraRelations,
			eq(cyclistInfraRelationCities.relation_id, cyclistInfraRelations.id),
		);

	const groupedData: Record<string, {
		city_id: number;
		name: string;
		state: string;
		relations: Array<{
			relation_id: number;
			pdc_ref: string | null;
			name: string | null;
			cod_name: string;
			length: number;
			has_cycleway_length: number;
			pdc_typology: string | null;
			typologies_str: string;
			typologies: Record<string, number>;
		}>;
	}> = {};

	for (const row of result) {
		const cityKey = row.city_id.toString();

		if (!groupedData[cityKey]) {
			groupedData[cityKey] = {
				city_id: row.city_id,
				name: row.name,
				state: row.state,
				relations: [],
			};
		}

		groupedData[cityKey].relations.push({
			relation_id: row.relation_id,
			pdc_ref: row.pdc_ref,
			name: row.relation_name,
			cod_name: `(${row.pdc_ref}) ${row.relation_name}`,
			length: 0,
			has_cycleway_length: 0,
			pdc_typology: row.pdc_typology,
			typologies_str: "none",
			typologies: { none: 0 },
		});
	}

	return c.json(groupedData, 200);
};
