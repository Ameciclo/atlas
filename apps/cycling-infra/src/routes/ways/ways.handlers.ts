import { createConnectedDatabase } from "@atlas/database";
import {
	pdcRelationWays,
	ciclomapaInfra,
} from "@atlas/database/schemas/cycling-infra";

export const listWays = async (c: { json: (data: any) => any }) => {
	const db = await createConnectedDatabase();

	const ways = await db.select().from(pdcRelationWays);
	return c.json(ways);
};

export const getWaysSummary = async (c: { json: (data: any) => any }) => {
	const db = await createConnectedDatabase();

	// Get all ways and infrastructure data
	const ways = await db.select().from(pdcRelationWays);
	const infrastructure = await db.select().from(ciclomapaInfra);

	// Create a map of existing infrastructure by osm_id
	const infraMap = new Map();
	infrastructure.forEach((infra) => {
		infraMap.set(infra.osm_id, infra);
	});

	// Calculate summary for all ways
	const allSummary = calculateSummary(ways, infraMap);

	// Group by city (simplified - using first city from pdc_cities)
	const byCity: Record<
		string,
		{ pdc_feito: number; out_pdc: number; pdc_total: number; percent: number }
	> = {};

	// For now, return simplified summary
	const summary = {
		all: allSummary,
		byCity: byCity,
	};

	return c.json(summary);
};

export const getAllWaysGeoJSON = async (c: { json: (data: any) => any }) => {
	const db = await createConnectedDatabase();

	const ways = await db.select().from(pdcRelationWays);
	const infrastructure = await db.select().from(ciclomapaInfra);

	// Create infrastructure map
	const infraMap = new Map();
	infrastructure.forEach((infra) => {
		infraMap.set(infra.osm_id, infra);
	});

	// Convert to GeoJSON features
	const features = ways.map((way) => {
		const hasInfra = infraMap.has(way.osm_id);
		const isNotOutPDC = way.relation_id !== null;

		let status = "NotPDC";
		if (isNotOutPDC) {
			status = hasInfra ? "Realizada" : "Projeto";
		}

		const geojson = way.geojson as { geometry?: any };
		const osmProperties = way.osm_properties as Record<string, any>;

		return {
			type: "Feature",
			geometry: geojson?.geometry,
			properties: {
				id: way.id,
				name: way.name,
				osm_id: way.osm_id,
				STATUS: status,
				...(osmProperties || {}),
			},
		};
	});

	const allGeoJSON = {
		type: "FeatureCollection" as const,
		features: features,
	};

	// Group by city (simplified)
	const byCity: Record<
		string,
		{ type: "FeatureCollection"; features: unknown[] }
	> = {};

	return c.json({
		all: allGeoJSON,
		byCity: byCity,
	});
};

function calculateSummary(ways: unknown[], infraMap: Map<string, unknown>) {
	let pdc_feito = 0;
	let out_pdc = 0;
	let pdc_total = 0;

	ways.forEach((way: any) => {
		const hasInfra = infraMap.has(way.osm_id);
		const isNotOutPDC = way.relation_id !== null;
		const length = 1; // Simplified - would need actual length calculation

		if (hasInfra && isNotOutPDC) {
			pdc_feito += length;
		}
		if (hasInfra && !isNotOutPDC) {
			out_pdc += length;
		}
		if (isNotOutPDC) {
			pdc_total += length;
		}
	});

	const percent = pdc_total > 0 ? pdc_feito / pdc_total : 0;

	return {
		pdc_feito,
		out_pdc,
		pdc_total,
		percent,
	};
}
