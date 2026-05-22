import { createConnectedDatabase } from "@atlas/database";
import { RMR_CITIES } from "./constants.js";

interface TypeRow {
	type: string;
	km: number;
}

interface CityTypeRow {
	city_id: number;
	type: string;
	km: number;
}

/**
 * Total existing cycling infrastructure (pdc_relation_ways with has_cycleway=true),
 * optionally filtered by city.
 */
export async function getExistingInfraKm(
	cityId?: number,
): Promise<{ total_km: number; by_type: Record<string, number> }> {
	const db = await createConnectedDatabase();

	const cityFilter = cityId ? `AND (prw.osm_properties->>'city_id')::int = ${cityId}` : "";

	const result = await db.execute(`
		SELECT
			prw.osm_properties->>'cycleway_typology' as type,
			ROUND(SUM((prw.osm_properties->>'length')::float))::float as km
		FROM pdc_relation_ways prw
		WHERE (prw.osm_properties->>'has_cycleway')::boolean = true
		  AND prw.osm_properties IS NOT NULL
		  ${cityFilter}
		GROUP BY prw.osm_properties->>'cycleway_typology'
	`);

	const rows = result.rows as unknown as TypeRow[];

	const by_type: Record<string, number> = {};
	let total_km = 0;
	for (const row of rows) {
		const km = Number(row.km) || 0;
		by_type[row.type] = km;
		total_km += km;
	}

	return { total_km: Number(total_km.toFixed(3)), by_type };
}

/**
 * Total km planned in PDC, filtered by RMR cities.
 */
export async function getPdcPlannedKm(): Promise<{
	total_km: number;
	by_type: Record<string, number>;
}> {
	const db = await createConnectedDatabase();

	const result = await db.execute(`
		SELECT
			cir.pdc_typology as type,
			ROUND(SUM(cir.pdc_km))::float as km
		FROM cyclist_infra_relations cir
		INNER JOIN cyclist_infra_relation_cities circ ON cir.id = circ.relation_id
		INNER JOIN cities c ON circ.city_id = c.id
		WHERE c.rmr = true AND cir.pdc_km IS NOT NULL AND cir.pdc_typology IS NOT NULL
		GROUP BY cir.pdc_typology
	`);

	const rows = result.rows as unknown as TypeRow[];
	const by_type: Record<string, number> = {};
	let total_km = 0;
	for (const row of rows) {
		const km = Number(row.km) || 0;
		by_type[row.type] = km;
		total_km += km;
	}

	return { total_km: Number(total_km.toFixed(3)), by_type };
}

/**
 * PDC ways implementation breakdown, filtered by RMR cities.
 * Statuses: pdc_feito (has_cycleway=true, relation_id IS NOT NULL)
 *           pdc_nao_realizado (has_cycleway=false, relation_id IS NOT NULL)
 *           realizado_fora_pdc (relation_id IS NULL or 0)
 */
export async function getPdcWaysBreakdown(): Promise<{
	pdc_feito_km: number;
	pdc_nao_realizado_km: number;
	realizado_fora_pdc_km: number;
	pdc_feito_by_type: Record<string, number>;
	pdc_nao_realizado_by_type: Record<string, number>;
}> {
	const db = await createConnectedDatabase();

	// Get ways scoped to RMR cities — use osm_properties->>city_id directly
	// to avoid row duplication from LEFT JOIN when a relation spans multiple cities.
	const allWays = await db.execute(`
		SELECT
			prw.id,
			prw.relation_id,
			(prw.osm_properties->>'length')::float as length,
			(prw.osm_properties->>'has_cycleway')::boolean as has_cycleway,
			prw.osm_properties->>'cycleway_typology' as cycleway_typology,
			prw.osm_properties->>'pdc_typology' as pdc_typology,
			(prw.osm_properties->>'city_id')::int as city_id
		FROM pdc_relation_ways prw
		WHERE prw.osm_properties IS NOT NULL
	`);

	const rmrSet = new Set(RMR_CITIES);
	const waysRows = allWays.rows as unknown as {
		relation_id: number | null;
		length: number;
		has_cycleway: boolean;
		cycleway_typology: string | null;
		pdc_typology: string | null;
		city_id: number | null;
	}[];

	const pdc_feito_by_type: Record<string, number> = {};
	const pdc_nao_realizado_by_type: Record<string, number> = {};
	let pdc_feito_km = 0;
	let pdc_nao_realizado_km = 0;
	let realizado_fora_pdc_km = 0;

	for (const way of waysRows) {
		const length = Number(way.length) || 0;
		const hasRelation = way.relation_id !== null && way.relation_id !== 0;
		const cityId = way.city_id;
		const inRmr = cityId && rmrSet.has(cityId);
		const typology = way.cycleway_typology || way.pdc_typology || "indefinido";

		if (inRmr) {
			if (way.has_cycleway && hasRelation) {
				pdc_feito_km += length;
				pdc_feito_by_type[typology] = (pdc_feito_by_type[typology] || 0) + length;
			} else if (way.has_cycleway && !hasRelation) {
				realizado_fora_pdc_km += length;
			} else if (!way.has_cycleway && hasRelation) {
				pdc_nao_realizado_km += length;
				pdc_nao_realizado_by_type[typology] = (pdc_nao_realizado_by_type[typology] || 0) + length;
			}
		} else if (!cityId) {
			// Ways without city_id - treat as RMR by default if they have a relation
			if (way.has_cycleway && hasRelation) {
				pdc_feito_km += length;
				pdc_feito_by_type[typology] = (pdc_feito_by_type[typology] || 0) + length;
			} else if (way.has_cycleway && !hasRelation) {
				realizado_fora_pdc_km += length;
			} else if (!way.has_cycleway && hasRelation) {
				pdc_nao_realizado_km += length;
				pdc_nao_realizado_by_type[typology] = (pdc_nao_realizado_by_type[typology] || 0) + length;
			}
		}
	}

	return {
		pdc_feito_km: Number(pdc_feito_km.toFixed(3)),
		pdc_nao_realizado_km: Number(pdc_nao_realizado_km.toFixed(3)),
		realizado_fora_pdc_km: Number(realizado_fora_pdc_km.toFixed(3)),
		pdc_feito_by_type,
		pdc_nao_realizado_by_type,
	};
}

/**
 * Get coverage info for all RMR cities or a specific one.
 */
export async function getInfraPerCity(cityId?: number): Promise<
	{
		city_id: number;
		city_name: string;
		existing_km: number;
		planned_km: number;
		implemented_km: number;
	}[]
> {
	const db = await createConnectedDatabase();

	const cityFilter = cityId ? `AND c.id = ${cityId}` : "";

	const result = await db.execute(`
		WITH existing AS (
			SELECT
				(prw.osm_properties->>'city_id')::int as city_id,
				ROUND(SUM((prw.osm_properties->>'length')::float)::numeric, 3) as existing_km
			FROM pdc_relation_ways prw
			WHERE (prw.osm_properties->>'has_cycleway')::boolean = true
			  AND prw.osm_properties IS NOT NULL
			  AND prw.osm_properties->>'city_id' IS NOT NULL
			GROUP BY (prw.osm_properties->>'city_id')::int
		),
		planned AS (
			SELECT
				circ.city_id,
				ROUND(SUM(cir.pdc_km)::numeric, 3) as planned_km
			FROM cyclist_infra_relation_cities circ
			INNER JOIN cyclist_infra_relations cir ON circ.relation_id = cir.id
			WHERE cir.pdc_km IS NOT NULL
			GROUP BY circ.city_id
		),
		implemented AS (
			SELECT
				circ.city_id,
				ROUND(SUM((prw.osm_properties->>'length')::float)::numeric, 3) as implemented_km
			FROM cyclist_infra_relation_cities circ
			INNER JOIN cyclist_infra_relations cir ON circ.relation_id = cir.id
			INNER JOIN pdc_relation_ways prw ON prw.relation_id = cir.id
			WHERE (prw.osm_properties->>'has_cycleway')::boolean = true
			GROUP BY circ.city_id
		)
		SELECT
			c.id as city_id,
			c.name as city_name,
			COALESCE(e.existing_km, 0)::float as existing_km,
			COALESCE(p.planned_km, 0)::float as planned_km,
			COALESCE(i.implemented_km, 0)::float as implemented_km
		FROM cities c
		LEFT JOIN existing e ON c.id = e.city_id
		LEFT JOIN planned p ON c.id = p.city_id
		LEFT JOIN implemented i ON c.id = i.city_id
		WHERE c.rmr = true ${cityFilter}
		ORDER BY c.name
	`);

	return (result.rows as unknown as {
		city_id: number;
		city_name: string;
		existing_km: number | null;
		planned_km: number | null;
		implemented_km: number | null;
	}[]).map((row) => ({
		city_id: row.city_id,
		city_name: row.city_name,
		existing_km: Number((row.existing_km || 0).toFixed(3)),
		planned_km: Number((row.planned_km || 0).toFixed(3)),
		implemented_km: Number((row.implemented_km || 0).toFixed(3)),
	}));
}

/**
 * Get PDC route details for a specific city (Recife).
 */
export async function getPdcRoutesForCity(
	cityId: number,
): Promise<
	{ route_name: string; planned_typology: string; planned_extension_km: number; executed_km: number }[]
> {
	const db = await createConnectedDatabase();

	const result = await db.execute(`
		SELECT
			cir.name as route_name,
			cir.pdc_typology as planned_typology,
			ROUND(COALESCE(cir.pdc_km, 0))::float as planned_extension_km,
			ROUND(COALESCE(SUM((prw.osm_properties->>'length')::float) FILTER (WHERE (prw.osm_properties->>'has_cycleway')::boolean = true), 0))::float as executed_km
		FROM cyclist_infra_relations cir
		INNER JOIN cyclist_infra_relation_cities circ ON cir.id = circ.relation_id
		LEFT JOIN pdc_relation_ways prw ON prw.relation_id = cir.id
		WHERE circ.city_id = ${cityId}
		  AND cir.pdc_typology IS NOT NULL
		GROUP BY cir.id, cir.name, cir.pdc_typology, cir.pdc_km
		ORDER BY cir.pdc_ref
	`);

	return (result.rows as unknown as {
		route_name: string;
		planned_typology: string;
		planned_extension_km: number | null;
		executed_km: number | null;
	}[]).map((row) => ({
		route_name: row.route_name,
		planned_typology: row.planned_typology,
		planned_extension_km: Number((row.planned_extension_km || 0).toFixed(3)),
		executed_km: Number((row.executed_km || 0).toFixed(3)),
	}));
}
