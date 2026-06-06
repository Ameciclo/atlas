import { createConnectedDatabase } from "@atlas/database";
import type { AppRouteHandler } from "../../lib/types.js";
import type { RelationsByCityRoute } from "./relations-by-city.routes.js";

interface CityRow {
	city_id: number;
	name: string;
	state: string;
	relation_id: number;
	pdc_ref: string | null;
	relation_name: string | null;
	pdc_typology: string | null;
}

interface WayRow {
	relation_id: number;
	length: number;
	has_cycleway: boolean;
	cycleway_typology: string;
}

export const relationsByCity: AppRouteHandler<RelationsByCityRoute> = async (
	c,
) => {
	const db = await createConnectedDatabase();

	const result = await db.execute(`
		SELECT
			c.id as city_id,
			c.name,
			c.state,
			cir.id as relation_id,
			cir.pdc_ref,
			cir.name as relation_name,
			cir.pdc_typology
		FROM cities c
		INNER JOIN cyclist_infra_relation_cities circ ON c.id = circ.city_id
		INNER JOIN cyclist_infra_relations cir ON circ.relation_id = cir.id
		WHERE c.rmr = true
		ORDER BY c.name, cir.pdc_ref
	`);

	const cityRows = result.rows as unknown as CityRow[];

	const relationIds = [...new Set(cityRows.map((r) => r.relation_id))];

	const waysPerRelation: Record<number, WayRow[]> = {};
	if (relationIds.length > 0) {
		const waysResult = await db.execute(`
			SELECT
				prw.relation_id,
				(prw.osm_properties->>'length')::float as length,
				(prw.osm_properties->>'has_cycleway')::boolean as has_cycleway,
				prw.osm_properties->>'cycleway_typology' as cycleway_typology
			FROM pdc_relation_ways prw
			WHERE prw.relation_id IS NOT NULL
			  AND prw.relation_id = ANY(ARRAY[${relationIds.join(",")}]::int[])
			  AND prw.osm_properties IS NOT NULL
		`);
		for (const wayRow of waysResult.rows as unknown as WayRow[]) {
			const relId = wayRow.relation_id;
			(waysPerRelation[relId] ??= []).push(wayRow);
		}
	}

	const groupedData: Record<
		string,
		{
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
		}
	> = {};

	for (const row of cityRows) {
		const cityKey = row.city_id.toString();

		if (!groupedData[cityKey]) {
			groupedData[cityKey] = {
				city_id: row.city_id,
				name: row.name,
				state: row.state,
				relations: [],
			};
		}

		const ways = waysPerRelation[row.relation_id] || [];
		const totalLength = ways.reduce((sum, w) => sum + (w.length || 0), 0);
		const cyclewayLength = ways
			.filter((w) => w.has_cycleway)
			.reduce((sum, w) => sum + (w.length || 0), 0);

		const typologiesMap: Record<string, number> = {};
		for (const w of ways) {
			const typ = w.cycleway_typology || "none";
			typologiesMap[typ] = (typologiesMap[typ] || 0) + (w.length || 0);
		}

		const typologiesStr =
			Object.entries(typologiesMap)
				.filter(([, v]) => v > 0)
				.map(([k, v]) => `${k}: ${Number(v.toFixed(1))} km`)
				.join(" | ") || "none";

		groupedData[cityKey].relations.push({
			relation_id: row.relation_id,
			pdc_ref: row.pdc_ref,
			name: row.relation_name,
			cod_name: `(${row.pdc_ref}) ${row.relation_name}`,
			length: Number(totalLength.toFixed(3)),
			has_cycleway_length: Number(cyclewayLength.toFixed(3)),
			pdc_typology: row.pdc_typology,
			typologies_str: typologiesStr,
			typologies: typologiesMap,
		});
	}

	return c.json(groupedData, 200);
};
