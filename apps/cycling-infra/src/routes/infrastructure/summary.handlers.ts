import { createConnectedDatabase } from "@atlas/database";
import {
	getExistingInfraKm,
	getPdcPlannedKm,
	getPdcWaysBreakdown,
	getInfraPerCity,
	getPdcRoutesForCity,
} from "../../lib/queries.js";
import type { AppRouteHandler } from "../../lib/types.js";
import type {
	SummaryRoute,
	CyclewaysRoute,
	CityCoverageRoute,
	CitySpecificSummaryRoute,
} from "./summary.routes.js";

export const summary: AppRouteHandler<SummaryRoute> = async (c) => {
	const [existing, planned, breakdown] = await Promise.all([
		getExistingInfraKm(),
		getPdcPlannedKm(),
		getPdcWaysBreakdown(),
	]);

	const implemented_km = breakdown.pdc_feito_km;
	const plan_coverage_percentage =
		planned.total_km > 0
			? Number(((implemented_km / planned.total_km) * 100).toFixed(1))
			: 0;

	// Merge by_type: all unique types from existing + planned + implemented
	const allTypes = new Set([
		...Object.keys(existing.by_type),
		...Object.keys(planned.by_type),
		...Object.keys(breakdown.pdc_feito_by_type),
	]);

	const by_type: Record<
		string,
		{ existing: number; planned: number; implemented: number }
	> = {};
	for (const t of allTypes) {
		by_type[t] = {
			existing: Number((existing.by_type[t] || 0).toFixed(1)),
			planned: Number((planned.by_type[t] || 0).toFixed(1)),
			implemented: Number(
				((breakdown.pdc_feito_by_type[t] || 0) +
					(breakdown.pdc_nao_realizado_by_type[t] || 0))
					.toFixed(1),
			),
		};
	}

	return c.json({
		existing_infrastructure_km: existing.total_km,
		planned_infrastructure_km: planned.total_km,
		implemented_from_plan_km: implemented_km,
		plan_coverage_percentage,
		by_type,
		last_updated: new Date().toISOString(),
	});
};

export const cycleways: AppRouteHandler<CyclewaysRoute> = async (c) => {
	const db = await createConnectedDatabase();

	// Existing infrastructure features from non-PDC ways (no PDC relation)
	const rmrCityIds = [2600054, 2601052, 2602902, 2603454, 2606804, 2607208, 2607604, 2607752, 2607901, 2609402, 2609600, 2610707, 2611606, 2613701];

	const existingFeatures = await db.execute(`
		SELECT
			prw.osm_id,
			prw.name,
			prw.osm_properties->>'cycleway_typology' as infra_type,
			(prw.osm_properties->>'city_id')::int as city_id,
			ST_AsGeoJSON(prw.coordinates, 5) as geometry
		FROM pdc_relation_ways prw
		WHERE prw.coordinates IS NOT NULL
		  AND prw.osm_properties IS NOT NULL
		  AND (prw.osm_properties->>'has_cycleway')::boolean = true
		  AND (prw.relation_id IS NULL OR prw.relation_id = 0)
	`);

	const pdcFeatures = await db.execute(`
		SELECT
			prw.osm_id,
			prw.name,
			prw.relation_id,
			(prw.osm_properties->>'has_cycleway')::boolean as has_cycleway,
			prw.osm_properties->>'cycleway_typology' as cycleway_typology,
			prw.osm_properties->>'pdc_typology' as pdc_typology,
			ST_AsGeoJSON(prw.coordinates, 5) as geometry,
			(prw.osm_properties->>'city_id')::int as city_id
		FROM pdc_relation_ways prw
		WHERE prw.coordinates IS NOT NULL
	`);

	const rmrSet = new Set(rmrCityIds);
	const features: Array<{
		type: "Feature";
		geometry: unknown;
		properties: Record<string, unknown>;
	}> = [];

	// Non-PDC existing features: status = "realizado_fora_pdc"
	const existingRows = existingFeatures.rows as unknown as {
		geometry: string;
		name: string | null;
		infra_type: string;
		city_id: number | null;
	}[];
	for (const row of existingRows) {
		if (!row.city_id || !rmrSet.has(row.city_id)) continue;
		features.push({
			type: "Feature",
			geometry: JSON.parse(row.geometry),
			properties: {
				name: row.name,
				infra_type: row.infra_type,
				status_type: "realizado_fora_pdc",
				city_id: row.city_id,
			},
		});
	}

	// PDC features with status
	const pdcRows = pdcFeatures.rows as unknown as {
		geometry: string;
		name: string | null;
		relation_id: number | null;
		has_cycleway: boolean | null;
		cycleway_typology: string | null;
		pdc_typology: string | null;
		city_id: number | null;
	}[];
	for (const row of pdcRows) {
		const hasRelation = row.relation_id !== null && row.relation_id !== 0;
		const inRmr = row.city_id && rmrSet.has(row.city_id);

		let statusType = "realizado_fora_pdc";
		if (hasRelation && row.has_cycleway) {
			statusType = "pdc_realizado_designado";
		} else if (hasRelation && !row.has_cycleway) {
			statusType = "pdc_nao_realizado";
		} else if (!hasRelation && row.has_cycleway) {
			statusType = "realizado_fora_pdc";
		}

		const geoCityId = row.city_id || 0;
		const skip = !hasRelation && !row.has_cycleway;

		if (!skip && (inRmr || (!row.city_id && hasRelation))) {
			features.push({
				type: "Feature",
				geometry: JSON.parse(row.geometry),
				properties: {
					name: row.name,
					cycleway_typology: row.cycleway_typology,
					pdc_typology: row.pdc_typology,
					status_type: statusType,
					city_id: geoCityId,
				},
			});
		}
	}

	// Compute summary for the response
	const [existing, planned, breakdown] = await Promise.all([
		getExistingInfraKm(),
		getPdcPlannedKm(),
		getPdcWaysBreakdown(),
	]);

	const implemented_km = breakdown.pdc_feito_km;
	const plan_coverage_percentage =
		planned.total_km > 0
			? Number(((implemented_km / planned.total_km) * 100).toFixed(1))
			: 0;

	const allTypes = new Set([
		...Object.keys(existing.by_type),
		...Object.keys(planned.by_type),
	]);
	const by_type: Record<
		string,
		{ existing: number; planned: number; implemented: number }
	> = {};
	for (const t of allTypes) {
		by_type[t] = {
			existing: Number((existing.by_type[t] || 0).toFixed(1)),
			planned: Number((planned.by_type[t] || 0).toFixed(1)),
			implemented: Number((breakdown.pdc_feito_by_type[t] || 0).toFixed(1)),
		};
	}

	return c.json({
		type: "FeatureCollection" as const,
		features,
		summary: {
			existing_infrastructure_km: existing.total_km,
			planned_infrastructure_km: planned.total_km,
			implemented_from_plan_km: implemented_km,
			plan_coverage_percentage,
			by_type,
			last_updated: new Date().toISOString(),
		},
	});
};

export const cityCoverage: AppRouteHandler<CityCoverageRoute> = async (c) => {
	const perCity = await getInfraPerCity();

	const cities = perCity.map((city) => {
		const plan_coverage_percentage =
			city.planned_km > 0
				? Number(((city.implemented_km / city.planned_km) * 100).toFixed(1))
				: 0;

		return {
			city_id: city.city_id,
			city_name: city.city_name,
			existing_infrastructure_km: city.existing_km,
			planned_infrastructure_km: city.planned_km,
			implemented_from_plan_km: city.implemented_km,
			plan_coverage_percentage,
			by_type: {} as Record<
				string,
				{ existing: number; planned: number; implemented: number }
			>,
			last_updated: new Date().toISOString(),
		};
	});

	return c.json({ cities });
};

export const citySpecificSummary: AppRouteHandler<
	CitySpecificSummaryRoute
> = async (c) => {
	const { city_id } = c.req.valid("param");

	const [perCity, routes] = await Promise.all([
		getInfraPerCity(city_id),
		getPdcRoutesForCity(city_id),
	]);

	const city = perCity[0];

	if (!city) {
		return c.json({
			existing_infrastructure_km: 0,
			planned_infrastructure_km: 0,
			implemented_from_plan_km: 0,
			plan_coverage_percentage: 0,
			by_type: {},
			last_updated: new Date().toISOString(),
		});
	}

	const plan_coverage_percentage =
		city.planned_km > 0
			? Number(((city.implemented_km / city.planned_km) * 100).toFixed(1))
			: 0;

	const baseResponse = {
		existing_infrastructure_km: city.existing_km,
		planned_infrastructure_km: city.planned_km,
		implemented_from_plan_km: city.implemented_km,
		plan_coverage_percentage,
		by_type: {} as Record<string, { existing: number; planned: number; implemented: number }>,
		last_updated: new Date().toISOString(),
	};

	if (routes.length > 0) {
		return c.json({
			...baseResponse,
			pdc_recife: { routes },
		});
	}

	return c.json(baseResponse);
};
