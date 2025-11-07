import { createConnectedDatabase } from "@atlas/database";
import { pdcRelationWays } from "@atlas/database/schemas/cycling-infra";
import type { AppRouteHandler } from "../../lib/types.js";
import type { ListRoute, GetSummaryRoute, GetAllRoute, GetNearbyRoute } from "./ways.routes.js";

// Helper function to calculate distance between two coordinates
function calculateDistance(coord1: [number, number], coord2: [number, number]): number {
	const R = 6371; // Earth's radius in km
	const dLat = (coord2[1] - coord1[1]) * Math.PI / 180;
	const dLon = (coord2[0] - coord1[0]) * Math.PI / 180;
	const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
			Math.cos(coord1[1] * Math.PI / 180) * Math.cos(coord2[1] * Math.PI / 180) *
			Math.sin(dLon/2) * Math.sin(dLon/2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
	return R * c;
}

// Calculate total length of a LineString or MultiLineString
function calculateGeometryLength(geometry: any): number {
	if (!geometry || !geometry.coordinates) return 0;
	
	let totalLength = 0;
	
	if (geometry.type === 'LineString') {
		const coords = geometry.coordinates;
		for (let i = 0; i < coords.length - 1; i++) {
			totalLength += calculateDistance(coords[i], coords[i + 1]);
		}
	} else if (geometry.type === 'MultiLineString') {
		for (const lineString of geometry.coordinates) {
			for (let i = 0; i < lineString.length - 1; i++) {
				totalLength += calculateDistance(lineString[i], lineString[i + 1]);
			}
		}
	}
	
	return totalLength;
}

export const list: AppRouteHandler<ListRoute> = async (c) => {
	const { city } = c.req.valid("query");
	const db = await createConnectedDatabase();
	
	let ways;
	if (city) {
		const result = await db.execute(`
			SELECT prw.*
			FROM pdc_relation_ways prw
			LEFT JOIN cyclist_infra_relation_cities circ ON prw.relation_id = circ.relation_id
			WHERE COALESCE(circ.city_id, (prw.osm_properties->>'city_id')::int) = ${parseInt(city, 10)}
		`);
		ways = result.rows;
	} else {
		ways = await db.select().from(pdcRelationWays);
	}
	
	// Transform to original format
	const transformedWays = ways.map(way => {
		const geojsonData = way.geojson as any;
		const osmProps = way.osm_properties as Record<string, any>;
		
		// Extract numeric OSM ID from string format (e.g., "relation/15997469" -> 15997469)
		const osmIdMatch = way.osm_id.match(/\/(\d+)$/);
		const numericOsmId = osmIdMatch && osmIdMatch[1] ? parseInt(osmIdMatch[1], 10) : 0;
		
		// Calculate length from geometry
		const length = calculateGeometryLength(geojsonData?.geometry);
		
		// Determine cycleway info from OSM properties
		const highway = osmProps?.highway || osmProps?.route || 'cycleway';
		const hasCycleway = highway === 'cycleway' || osmProps?.route === 'bicycle';
		const cyclewayTypology = osmProps?.description?.includes('Ciclovia') ? 'Ciclovia' : 
								 osmProps?.description?.includes('Ciclofaixa') ? 'Ciclofaixa' : 'Ciclovia';
		
		return {
			osmId: numericOsmId,
			name: way.name,
			length: parseFloat(length.toFixed(7)),
			highway: highway,
			hasCycleway: hasCycleway,
			cyclewayTypology: cyclewayTypology,
			relationId: way.relation_id || 0,
			geojson: {
				type: "FeatureCollection" as const,
				features: [{
					id: way.osm_id,
					type: "Feature" as const,
					geometry: geojsonData?.geometry || { type: "LineString", coordinates: [] },
					properties: {
						id: way.osm_id,
						...osmProps
					}
				}]
			},
			lastUpdated: null,
			cityId: 2613701, // Default to Recife
			dualCarriageway: false,
			pdcTypology: cyclewayTypology
		};
	});
	
	return c.json(transformedWays);
};

export const getSummary: AppRouteHandler<GetSummaryRoute> = async (c) => {
	const db = await createConnectedDatabase();
	
	// Debug: verificar dados disponíveis
	const debugData = await db.execute(`
		SELECT 
			'pdc_relation_ways' as table_name,
			COUNT(*) as total,
			COUNT(relation_id) as with_relation_id
		FROM pdc_relation_ways
		UNION ALL
		SELECT 
			'cyclist_infra_relation_cities',
			COUNT(*),
			COUNT(relation_id)
		FROM cyclist_infra_relation_cities
		UNION ALL
		SELECT 
			'ciclomapa_infra',
			COUNT(*),
			COUNT(osm_id)
		FROM ciclomapa_infra
	`);
	
	console.log('Debug data:', debugData.rows);
	
	// Query ways com city_id correto via JOIN
	const waysData = await db.execute(`
		SELECT 
			prw.id,
			prw.osm_id,
			prw.relation_id,
			(prw.osm_properties->>'length')::float as length,
			COALESCE(circ.city_id, (prw.osm_properties->>'city_id')::int, 2611606) as city_id,
			(prw.osm_properties->>'has_cycleway')::boolean as has_cycleway,
			prw.osm_properties->>'pdc_typology' as pdc_typology,
			prw.osm_properties->>'cycleway_typology' as cycleway_typology
		FROM pdc_relation_ways prw
		LEFT JOIN cyclist_infra_relation_cities circ ON prw.relation_id = circ.relation_id
		WHERE prw.osm_properties IS NOT NULL
	`);
	
	console.log('Total ways found:', waysData.rows.length);
	console.log('Ways with relation_id:', waysData.rows.filter(r => r.relation_id).length);
	console.log('Ways with city_id:', waysData.rows.filter(r => r.city_id).length);
	console.log('Ways with cycleway:', waysData.rows.filter(r => r.has_cycleway).length);
	console.log('Sample:', waysData.rows.slice(0, 3));
	
	const cities: { [key: string]: any[] } = {};
	
	waysData.rows.forEach((row: any) => {
		const cityId = row.city_id?.toString() || '2611606';
		if (!cities[cityId]) {
			cities[cityId] = [];
		}
		cities[cityId].push({
			length: parseFloat(row.length) || 0,
			hasCycleway: row.has_cycleway === true,
			relationId: row.relation_id || 0,
			pdcTypology: row.pdc_typology,
			cyclewayTypology: row.cycleway_typology
		});
	});
	
	// Buscar todas as cidades que têm relações PDC
	const allPdcCities = await db.execute(`
		SELECT DISTINCT 
			c.id as city_id,
			c.name as city_name
		FROM cities c
		INNER JOIN cyclist_infra_relation_cities circ ON c.id = circ.city_id
		ORDER BY c.name
	`);

	console.log('PDC Cities found:', allPdcCities.rows.length);

	const summaryByCity: { [key: string]: any } = {};
	
	// Processar cidades com dados
	for (const city in cities) {
		if (cities.hasOwnProperty(city) && city !== '0') {
			const cityData = cities[city];
			const citySummary = generateCitySummary(cityData || []);
			summaryByCity[city] = citySummary;
		}
	}

	// Adicionar cidades PDC sem dados (zeros)
	allPdcCities.rows.forEach((cityRow: any) => {
		const cityId = cityRow.city_id.toString();
		if (!summaryByCity[cityId]) {
			summaryByCity[cityId] = {
				pdc_feito: 0,
				out_pdc: 0,
				pdc_total: 0,
				real_pdc: 0,
				percent: 0,
				real_percent: 0
			};
		}
	});
	
	const allCityData = Object.values(cities).flat();
	const allCitySummary = generateCitySummary(allCityData || []);
	
	return c.json({ all: allCitySummary, byCity: summaryByCity });
};

function generateCitySummary(cityData: any[]) {
	const newData = cityData.map((d) => {
		const hasCycleway = d.hasCycleway === true;
		const isNotOutPDC = d.relationId !== 0; // 0 = não PDC, >0 = PDC
		
		const pdc_feito = hasCycleway && isNotOutPDC ? d.length : 0;
		const out_pdc = hasCycleway && !isNotOutPDC ? d.length : 0;
		const pdc_total = isNotOutPDC ? d.length : 0;
		const real_pdc = hasCycleway && isNotOutPDC && d.pdcTypology === d.cyclewayTypology ? d.length : 0;
		
		return { pdc_feito, out_pdc, pdc_total, real_pdc };
	});
	
	const kms = newData.reduce(
		(accumulator, currentData) => {
			accumulator.pdc_feito += currentData.pdc_feito;
			accumulator.out_pdc += currentData.out_pdc;
			accumulator.pdc_total += currentData.pdc_total;
			accumulator.real_pdc += currentData.real_pdc;
			return accumulator;
		},
		{ pdc_feito: 0, out_pdc: 0, pdc_total: 0, real_pdc: 0 }
	);
	
	const percent = kms.pdc_total > 0 ? kms.pdc_feito / kms.pdc_total : 0;
	const real_percent = kms.pdc_total > 0 ? kms.real_pdc / kms.pdc_total : 0;
	
	return { ...kms, percent, real_percent };
}

export const getAll: AppRouteHandler<GetAllRoute> = async (c) => {
	const { city } = c.req.valid("query");
	const db = await createConnectedDatabase();
	
	let ways;
	if (city) {
		const result = await db.execute(`
			SELECT prw.*
			FROM pdc_relation_ways prw
			LEFT JOIN cyclist_infra_relation_cities circ ON prw.relation_id = circ.relation_id
			WHERE COALESCE(circ.city_id, (prw.osm_properties->>'city_id')::int) = ${parseInt(city, 10)}
		`);
		ways = result.rows;
	} else {
		ways = await db.select().from(pdcRelationWays);
	}
	
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

export const getNearby: AppRouteHandler<GetNearbyRoute> = async (c) => {
	const { lat, lon, radius = "1000" } = c.req.valid("query");
	const db = await createConnectedDatabase();
	
	const latitude = parseFloat(lat);
	const longitude = parseFloat(lon);
	const radiusMeters = parseInt(radius, 10);
	
	// Query PDC ways within radius using PostGIS coordinates field
	const result = await db.execute(`
		SELECT 
			prw.id,
			prw.osm_id,
			prw.name,
			prw.geojson,
			prw.osm_properties,
			cir.pdc_ref,
			cir.name as relation_name,
			cir.pdc_typology,
			cir.pdc_stretch,
			(prw.osm_properties->>'length')::float as length_km,
			(prw.osm_properties->>'has_cycleway')::boolean as executed,
			ST_Distance(
				prw.coordinates::geography,
				ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
			) as distance_meters
		FROM pdc_relation_ways prw
		LEFT JOIN cyclist_infra_relations cir ON prw.relation_id = cir.id
		WHERE ST_DWithin(
			prw.coordinates::geography,
			ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
			${radiusMeters}
		)
		AND prw.coordinates IS NOT NULL
		ORDER BY distance_meters
	`);
	
	const ways = result.rows as any[];
	
	// Convert to GeoJSON features
	const features = ways.map(way => ({
		type: "Feature" as const,
		id: way.osm_id,
		properties: {
			...(way.osm_properties || {}),
			pdc_ref: way.pdc_ref,
			name: way.relation_name || way.name,
			pdc_typology: way.pdc_typology,
			description: way.pdc_stretch,
			executed: way.executed || false,
			length_km: parseFloat((way.length_km || 0).toFixed(3)),
			distance_meters: Math.round(way.distance_meters || 0),
		},
		geometry: way.geojson?.geometry || null,
	}));
	
	// Calculate summary
	const totalWays = features.length;
	const executedWays = features.filter(f => f.properties.executed).length;
	const totalLength = features.reduce((sum, f) => sum + f.properties.length_km, 0);
	const executedLength = features
		.filter(f => f.properties.executed)
		.reduce((sum, f) => sum + f.properties.length_km, 0);
	
	return c.json({
		type: "FeatureCollection" as const,
		features,
		summary: {
			total_ways: totalWays,
			executed_ways: executedWays,
			total_length_km: parseFloat(totalLength.toFixed(3)),
			executed_length_km: parseFloat(executedLength.toFixed(3)),
			execution_percentage: totalLength > 0 ? parseFloat(((executedLength / totalLength) * 100).toFixed(1)) : 0,
		},
	});
};