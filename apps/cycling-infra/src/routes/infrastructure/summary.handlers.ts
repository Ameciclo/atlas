import type { AppRouteHandler } from "../../lib/types.js";
import type {
	SummaryRoute,
	CyclewaysRoute,
	CityCoverageRoute,
	CitySpecificSummaryRoute,
} from "./summary.routes.js";

export const summary = async (c: any) => {
	const { city: _city, type: _type } = c.req.valid("query");

	// Mock data - would integrate with actual database
	const mockSummary = {
		existing_infrastructure_km: 120.5,
		planned_infrastructure_km: 200.0,
		implemented_from_plan_km: 45.2,
		plan_coverage_percentage: 22.6,
		by_type: {
			ciclovia: { existing: 80.2, planned: 120.0, implemented: 30.1 },
			ciclofaixa: { existing: 40.3, planned: 80.0, implemented: 15.1 },
		},
		last_updated: new Date().toISOString(),
	};

	return c.json(mockSummary);
};

export const cycleways = async (c: any) => {
	const { city: _city, type: _type } = c.req.valid("query");

	// Mock GeoJSON data
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

	// Mock city coverage data
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

	// Mock city specific data with PDC Recife
	const mockCityData = {
		existing_infrastructure_km: 85.2,
		planned_infrastructure_km: 150.0,
		implemented_from_plan_km: 32.1,
		plan_coverage_percentage: 21.4,
		by_type: {
			ciclovia: { existing: 60.1, planned: 90.0, implemented: 22.5 },
			ciclofaixa: { existing: 25.1, planned: 60.0, implemented: 9.6 },
		},
		last_updated: new Date().toISOString(),
		...(Number(city_id) === 1 && {
			pdc_recife: {
				routes: [
					{
						route_name: "Via Mangue (COD-001)",
						planned_typology: "Ciclovia",
						planned_extension_km: 5.2,
						executed_typology: "Ciclofaixa",
						executed_extension_km: 3.1,
					},
					{
						route_name: "Av. Boa Viagem (COD-002)",
						planned_typology: "Ciclofaixa",
						planned_extension_km: 8.5,
						executed_typology: "Ciclofaixa",
						executed_extension_km: 8.5,
					},
				],
			},
		}),
	};

	return c.json(mockCityData);
};
