import { createConnectedDatabase } from "@atlas/database";
import { pdcRelationWays } from "@atlas/database/schemas/cycling-infra";
import type { AppRouteHandler } from "../../lib/types.js";
import type { ListRoute, GetSummaryRoute, GetAllRoute } from "./ways.routes.js";

export const list: AppRouteHandler<ListRoute> = async (c) => {
	const db = await createConnectedDatabase();
	const ways = await db.select().from(pdcRelationWays);
	
	// Transform dates to strings for JSON serialization
	const serializedWays = ways.map(way => ({
		...way,
		created_at: way.created_at.toISOString(),
		updated_at: way.updated_at.toISOString(),
	}));
	
	return c.json(serializedWays);
};

export const getSummary: AppRouteHandler<GetSummaryRoute> = async (c) => {
	// Mock summary data - in real implementation, this would calculate actual statistics
	const summary = {
		all: {
			pdc_feito: 150,
			out_pdc: 75,
			pdc_total: 300,
			percent: 50.0,
		},
		byCity: {
			"Recife": {
				pdc_feito: 100,
				out_pdc: 50,
				pdc_total: 200,
				percent: 50.0,
			},
			"Olinda": {
				pdc_feito: 50,
				out_pdc: 25,
				pdc_total: 100,
				percent: 50.0,
			},
		},
	};
	
	return c.json(summary);
};

export const getAll: AppRouteHandler<GetAllRoute> = async (c) => {
	const db = await createConnectedDatabase();
	const ways = await db.select().from(pdcRelationWays);
	
	// Convert to GeoJSON format
	const features = ways.map((way: any) => {
		const geojsonData = way.geojson as any;
		const osmProps = way.osm_properties as Record<string, any>;
		
		return {
			type: "Feature" as const,
			geometry: geojsonData?.geometry || { type: "LineString", coordinates: [] },
			properties: {
				...(osmProps || {}),
				STATUS: "Projeto" as const,
				id: way.id,
				osm_id: way.osm_id,
				name: way.name,
			},
		};
	});

	const response = {
		all: {
			type: "FeatureCollection" as const,
			features,
		},
		byCity: {
			"Recife": {
				type: "FeatureCollection" as const,
				features: features.slice(0, Math.floor(features.length / 2)),
			},
			"Olinda": {
				type: "FeatureCollection" as const,
				features: features.slice(Math.floor(features.length / 2)),
			},
		},
	};

	return c.json(response);
};