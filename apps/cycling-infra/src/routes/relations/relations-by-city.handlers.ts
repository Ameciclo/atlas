import { eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { createConnectedDatabase } from "@atlas/database";
import { 
	cities, 
	cyclistInfraRelations, 
	cyclistInfraRelationCities,
	pdcRelationWays 
} from "@atlas/database/schemas/cycling-infra";
import type { AppRouteHandler } from "../../lib/types.js";

export const relationsByCity: AppRouteHandler<any> = async (c) => {
	try {
		const db = await createConnectedDatabase();

		// Get cities with their relations
		const citiesData = await db
			.select()
			.from(cities)
			.innerJoin(
				cyclistInfraRelationCities,
				eq(cities.id, cyclistInfraRelationCities.city_id)
			);

		// Get all relations
		const relationsData = await db.select().from(cyclistInfraRelations);

		// Get all ways
		const waysData = await db.select().from(pdcRelationWays);

		const citiesWithInfo: { [key: number]: any } = {};

		citiesData.forEach((cityData) => {
			const city = cityData.cities;
			const relationCity = cityData.cyclist_infra_relation_cities;

			if (!citiesWithInfo[city.id]) {
				citiesWithInfo[city.id] = {
					city_id: city.id,
					name: city.name,
					state: city.state,
					relations: [],
				};
			}

			const relation = relationsData.find(r => r.id === relationCity.relation_id);
			if (relation) {
				const relationWays = waysData.filter(way => way.relation_id === relation.id);
				
				// Calculate total length (assuming coordinates contain length info)
				const relationLength = relationWays.length;
				const relationHasCyclewayLength = relationWays.length;

				// Extract typologies from OSM properties
				const typologies = relationWays.reduce((typologiesObj: { [key: string]: number }, way) => {
					const props = way.osm_properties as any;
					if (props?.cycleway || props?.highway) {
						const typology = props.cycleway || props.highway;
						typologiesObj[typology] = (typologiesObj[typology] || 0) + 1;
					}
					return typologiesObj;
				}, {});

				citiesWithInfo[city.id].relations.push({
					relation_id: relation.id,
					pdc_ref: relation.pdc_ref,
					name: relation.name,
					cod_name: `(${relation.pdc_ref}) ${relation.name}`,
					length: relationLength,
					has_cycleway_length: relationHasCyclewayLength,
					pdc_typology: relation.pdc_typology,
					typologies_str: Object.keys(typologies).join(", "),
					typologies,
				});
			}
		});

		return c.json(citiesWithInfo, HttpStatusCodes.OK);
	} catch (error) {
		console.error("Error fetching relations by city:", error);
		return c.json(
			{ message: "Internal Server Error" },
			HttpStatusCodes.INTERNAL_SERVER_ERROR,
		);
	}
};