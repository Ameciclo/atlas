import { sql } from "drizzle-orm";
import { createConnectedDatabase } from "@atlas/database";
import type { AppRouteHandler } from "../../lib/types.js";
import type {
	SummaryRoute,
	CyclewaysRoute,
	CityCoverageRoute,
	CitySpecificSummaryRoute,
} from "./summary.routes.js";

export const summary = async (c: any) => {
	const { city: _city, type: _type } = c.req.valid("query");
	const db = await createConnectedDatabase();

	const existingTotal = await db.execute(sql`
		SELECT CAST(SUM(ST_Length(coordinates::geography)) / 1000 AS NUMERIC(10,2)) as total_km
		FROM ciclomapa_infra WHERE coordinates IS NOT NULL
	`);

	const existingByType = await db.execute(sql`
		SELECT infra_type, CAST(SUM(ST_Length(coordinates::geography)) / 1000 AS NUMERIC(10,2)) as total_km
		FROM ciclomapa_infra WHERE coordinates IS NOT NULL GROUP BY infra_type
	`);

	const plannedTotal = await db.execute(sql`
		SELECT CAST(SUM(ST_Length(prw.coordinates::geography)) / 1000 AS NUMERIC(10,2)) as total_km
		FROM pdc_relation_ways prw JOIN cyclist_infra_relations cir ON prw.relation_id = cir.id
		WHERE prw.coordinates IS NOT NULL AND cir.notes = 'proposed'
	`);

	const plannedByType = await db.execute(sql`
		SELECT cir.pdc_typology, CAST(SUM(ST_Length(prw.coordinates::geography)) / 1000 AS NUMERIC(10,2)) as total_km
		FROM cyclist_infra_relations cir JOIN pdc_relation_ways prw ON prw.relation_id = cir.id
		WHERE prw.coordinates IS NOT NULL AND cir.notes = 'proposed' AND cir.pdc_typology IS NOT NULL
		GROUP BY cir.pdc_typology
	`);

	const implementedTotal = await db.execute(sql`
		SELECT CAST(SUM(ST_Length(prw.coordinates::geography)) / 1000 AS NUMERIC(10,2)) as total_km
		FROM pdc_relation_ways prw JOIN cyclist_infra_relations cir ON prw.relation_id = cir.id
		WHERE prw.coordinates IS NOT NULL AND cir.notes = 'existing'
	`);

	const implementedByType = await db.execute(sql`
		SELECT cir.pdc_typology, CAST(SUM(ST_Length(prw.coordinates::geography)) / 1000 AS NUMERIC(10,2)) as total_km
		FROM cyclist_infra_relations cir JOIN pdc_relation_ways prw ON prw.relation_id = cir.id
		WHERE prw.coordinates IS NOT NULL AND cir.notes = 'existing' AND cir.pdc_typology IS NOT NULL
		GROUP BY cir.pdc_typology
	`);

	const existingKm = Number(existingTotal.rows[0]?.total_km || 0);
	const plannedKm = Number(plannedTotal.rows[0]?.total_km || 0);
	const implementedKm = Number(implementedTotal.rows[0]?.total_km || 0);
	const coveragePercentage = plannedKm > 0 ? Number(((implementedKm / plannedKm) * 100).toFixed(2)) : 0;

	const byType: Record<string, any> = {};

	for (const row of existingByType.rows) {
		const type = String(row.infra_type).toLowerCase();
		if (!byType[type]) byType[type] = { existing: 0, planned: 0, implemented: 0 };
		byType[type].existing = Number(row.total_km);
	}

	for (const row of plannedByType.rows) {
		const type = String(row.pdc_typology).toLowerCase();
		if (!byType[type]) byType[type] = { existing: 0, planned: 0, implemented: 0 };
		byType[type].planned = Number(row.total_km);
	}

	for (const row of implementedByType.rows) {
		const type = String(row.pdc_typology).toLowerCase();
		if (!byType[type]) byType[type] = { existing: 0, planned: 0, implemented: 0 };
		byType[type].implemented = Number(row.total_km);
	}

	return c.json({
		existing_infrastructure_km: existingKm,
		planned_infrastructure_km: plannedKm,
		implemented_from_plan_km: implementedKm,
		plan_coverage_percentage: coveragePercentage,
		by_type: byType,
		last_updated: new Date().toISOString(),
	});
};

export const cycleways = async (c: any) => {
	const { city: _city, type: _type } = c.req.valid("query");

	const mockGeoJson = {
		type: "FeatureCollection" as const,
		features: [
			{
				type: "Feature",
				properties: {
					name: "Ciclovia Boa Viagem",
					type: "Ciclovia",
					length_km: 8.5,
					status: "existing",
				},
				geometry: {
					type: "LineString",
					coordinates: [
						[-34.9056, -8.1137],
						[-34.9156, -8.1237],
					],
				},
			},
		],
		summary: {
			existing_infrastructure_km: 120.5,
			planned_infrastructure_km: 200.0,
			implemented_from_plan_km: 45.2,
			plan_coverage_percentage: 22.6,
			by_type: {
				ciclovia: { existing: 80.2, planned: 120.0, implemented: 30.1 },
				ciclofaixa: { existing: 40.3, planned: 80.0, implemented: 15.1 },
			},
			last_updated: new Date().toISOString(),
		},
	};

	return c.json(mockGeoJson);
};

export const cityCoverage = async (c: any) => {
	const { state: _state, region: _region } = c.req.valid("query");

	const mockCities = {
		cities: [
			{
				city_id: 1,
				city_name: "Recife",
				existing_infrastructure_km: 85.2,
				planned_infrastructure_km: 150.0,
				implemented_from_plan_km: 32.1,
				plan_coverage_percentage: 21.4,
				by_type: {
					ciclovia: { existing: 60.1, planned: 90.0, implemented: 22.5 },
					ciclofaixa: { existing: 25.1, planned: 60.0, implemented: 9.6 },
				},
				last_updated: new Date().toISOString(),
			},
			{
				city_id: 2,
				city_name: "Olinda",
				existing_infrastructure_km: 35.3,
				planned_infrastructure_km: 50.0,
				implemented_from_plan_km: 13.1,
				plan_coverage_percentage: 26.2,
				by_type: {
					ciclovia: { existing: 20.1, planned: 30.0, implemented: 7.5 },
					ciclofaixa: { existing: 15.2, planned: 20.0, implemented: 5.6 },
				},
				last_updated: new Date().toISOString(),
			},
		],
	};

	return c.json(mockCities);
};

export const citySpecificSummary = async (c: any) => {
	const { city_id } = c.req.valid("param");
	const db = await createConnectedDatabase();

	const existingTotal = await db.execute(sql`
		SELECT CAST(SUM(ST_Length(coordinates::geography)) / 1000 AS NUMERIC(10,2)) as total_km
		FROM ciclomapa_infra WHERE coordinates IS NOT NULL
	`);

	const existingByType = await db.execute(sql`
		SELECT infra_type, CAST(SUM(ST_Length(coordinates::geography)) / 1000 AS NUMERIC(10,2)) as total_km
		FROM ciclomapa_infra WHERE coordinates IS NOT NULL GROUP BY infra_type
	`);

	const plannedTotal = await db.execute(sql`
		SELECT CAST(SUM(ST_Length(prw.coordinates::geography)) / 1000 AS NUMERIC(10,2)) as total_km
		FROM pdc_relation_ways prw JOIN cyclist_infra_relations cir ON prw.relation_id = cir.id
		WHERE prw.coordinates IS NOT NULL AND cir.notes = 'proposed'
	`);

	const plannedByType = await db.execute(sql`
		SELECT cir.pdc_typology, CAST(SUM(ST_Length(prw.coordinates::geography)) / 1000 AS NUMERIC(10,2)) as total_km
		FROM cyclist_infra_relations cir JOIN pdc_relation_ways prw ON prw.relation_id = cir.id
		WHERE prw.coordinates IS NOT NULL AND cir.notes = 'proposed' AND cir.pdc_typology IS NOT NULL
		GROUP BY cir.pdc_typology
	`);

	const implementedTotal = await db.execute(sql`
		SELECT CAST(SUM(ST_Length(prw.coordinates::geography)) / 1000 AS NUMERIC(10,2)) as total_km
		FROM pdc_relation_ways prw JOIN cyclist_infra_relations cir ON prw.relation_id = cir.id
		WHERE prw.coordinates IS NOT NULL AND cir.notes = 'existing'
	`);

	const implementedByType = await db.execute(sql`
		SELECT cir.pdc_typology, CAST(SUM(ST_Length(prw.coordinates::geography)) / 1000 AS NUMERIC(10,2)) as total_km
		FROM cyclist_infra_relations cir JOIN pdc_relation_ways prw ON prw.relation_id = cir.id
		WHERE prw.coordinates IS NOT NULL AND cir.notes = 'existing' AND cir.pdc_typology IS NOT NULL
		GROUP BY cir.pdc_typology
	`);

	const pdcRoutes = await db.execute(sql`
		SELECT cir.osm_id as route_name, cir.pdc_typology, cir.notes,
			CAST(SUM(ST_Length(prw.coordinates::geography)) / 1000 AS NUMERIC(10,2)) as total_km
		FROM cyclist_infra_relations cir JOIN pdc_relation_ways prw ON prw.relation_id = cir.id
		WHERE prw.coordinates IS NOT NULL AND cir.pdc_typology IS NOT NULL
		GROUP BY cir.id, cir.osm_id, cir.pdc_typology, cir.notes
		ORDER BY total_km DESC LIMIT 20
	`);

	const existingKm = Number(existingTotal.rows[0]?.total_km || 0);
	const plannedKm = Number(plannedTotal.rows[0]?.total_km || 0);
	const implementedKm = Number(implementedTotal.rows[0]?.total_km || 0);
	const coveragePercentage = plannedKm > 0 ? Number(((implementedKm / plannedKm) * 100).toFixed(2)) : 0;

	const byType: Record<string, any> = {};

	for (const row of existingByType.rows) {
		const type = String(row.infra_type).toLowerCase();
		if (!byType[type]) byType[type] = { existing: 0, planned: 0, implemented: 0 };
		byType[type].existing = Number(row.total_km);
	}

	for (const row of plannedByType.rows) {
		const type = String(row.pdc_typology).toLowerCase();
		if (!byType[type]) byType[type] = { existing: 0, planned: 0, implemented: 0 };
		byType[type].planned = Number(row.total_km);
	}

	for (const row of implementedByType.rows) {
		const type = String(row.pdc_typology).toLowerCase();
		if (!byType[type]) byType[type] = { existing: 0, planned: 0, implemented: 0 };
		byType[type].implemented = Number(row.total_km);
	}

	const routes = pdcRoutes.rows.map((row: any) => ({
		route_name: row.route_name,
		planned_typology: row.notes === 'proposed' ? row.pdc_typology : null,
		planned_extension_km: row.notes === 'proposed' ? Number(row.total_km) : 0,
		executed_typology: row.notes === 'existing' ? row.pdc_typology : null,
		executed_extension_km: row.notes === 'existing' ? Number(row.total_km) : 0,
	}));

	return c.json({
		existing_infrastructure_km: existingKm,
		planned_infrastructure_km: plannedKm,
		implemented_from_plan_km: implementedKm,
		plan_coverage_percentage: coveragePercentage,
		by_type: byType,
		last_updated: new Date().toISOString(),
		...(Number(city_id) === 1 && {
			pdc_recife: { routes },
		}),
	});
};
