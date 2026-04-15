import { pdcRelationWays } from "@atlas/database/schemas/cycling-infra";
import env from "../../env.js";
import type { AppRouteHandler } from "../../lib/types.js";
import type {
	ListRoute,
	GetSummaryRoute,
	GetAllRoute,
	GetNearbyRoute,
} from "./ways.routes.js";

// Helper function to calculate distance between two coordinates
function calculateDistance(
	coord1: [number, number],
	coord2: [number, number],
): number {
	const R = 6371; // Earth's radius in km
	const dLat = ((coord2[1] - coord1[1]) * Math.PI) / 180;
	const dLon = ((coord2[0] - coord1[0]) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((coord1[1] * Math.PI) / 180) *
			Math.cos((coord2[1] * Math.PI) / 180) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

// Calculate total length of a LineString or MultiLineString
function calculateGeometryLength(geometry: {
	type: string;
	coordinates: number[][] | number[][][];
}): number {
	if (!geometry || !geometry.coordinates) return 0;

	let totalLength = 0;

	if (geometry.type === "LineString") {
		const coords = geometry.coordinates as number[][];
		for (let i = 0; i < coords.length - 1; i++) {
			totalLength += calculateDistance(
				coords[i] as [number, number],
				coords[i + 1] as [number, number],
			);
		}
	} else if (geometry.type === "MultiLineString") {
		const multiCoords = geometry.coordinates as number[][][];
		for (const lineString of multiCoords) {
			for (let i = 0; i < lineString.length - 1; i++) {
				totalLength += calculateDistance(
					lineString[i] as [number, number],
					lineString[i + 1] as [number, number],
				);
			}
		}
	}

	return totalLength;
}

export const list = async (c: any) => {
	const { city } = c.req.valid("query");
	const db = c.get("db");

	let ways: Record<string, unknown>[];
	if (city) {
		const result = await db.execute(`
			SELECT prw.*
			FROM pdc_relation_ways prw
			LEFT JOIN cyclist_infra_relation_cities circ ON prw.relation_id = circ.relation_id
			WHERE COALESCE(circ.city_id, (prw.osm_properties->>'city_id')::int) = ${parseInt(city, 10)}
		`);
		ways = result.rows as Record<string, unknown>[];
	} else {
		ways = await db.select().from(pdcRelationWays);
	}

	// Transform to original format
	const transformedWays = ways.map((way) => {
		const geojsonData = way.geojson as {
			geometry?: { type: string; coordinates: number[][] | number[][][] };
		};
		const osmProps = way.osm_properties as Record<string, unknown>;

		// Extract numeric OSM ID from string format (e.g., "relation/15997469" -> 15997469)
		const osmIdMatch = String(way.osm_id).match(/\/(\d+)$/);
		const numericOsmId = osmIdMatch?.[1] ? parseInt(osmIdMatch[1], 10) : 0;

		// Calculate length from geometry
		const length = geojsonData?.geometry
			? calculateGeometryLength(geojsonData.geometry)
			: 0;

		// Determine cycleway info from OSM properties
		const highway =
			(osmProps?.highway as string) ||
			(osmProps?.route as string) ||
			"cycleway";
		const hasCycleway = highway === "cycleway" || osmProps?.route === "bicycle";
		const cyclewayTypology = (osmProps?.description as string)?.includes(
			"Ciclovia",
		)
			? "Ciclovia"
			: (osmProps?.description as string)?.includes("Ciclofaixa")
				? "Ciclofaixa"
				: "Ciclovia";

		return {
			osmId: numericOsmId,
			name: way.name,
			length: parseFloat(length.toFixed(7)),
			highway: highway,
			hasCycleway: hasCycleway,
			cyclewayTypology: cyclewayTypology,
			relationId: (way.relation_id as number) || 0,
			geojson: {
				type: "FeatureCollection" as const,
				features: [
					{
						id: way.osm_id,
						type: "Feature" as const,
						geometry: geojsonData?.geometry || {
							type: "LineString",
							coordinates: [],
						},
						properties: {
							id: way.osm_id,
							...osmProps,
						},
					},
				],
			},
			lastUpdated: null,
			cityId: 2613701, // Default to Recife
			dualCarriageway: false,
			pdcTypology: cyclewayTypology,
		};
	});

	return c.json(transformedWays);
};

export const getSummary = async (c: any) => {
	const db = c.get("db");

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

	console.log("Debug data:", debugData.rows);

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

	console.log("Total ways found:", waysData.rows.length);
	console.log(
		"Ways with relation_id:",
		waysData.rows.filter((r) => r.relation_id).length,
	);
	console.log(
		"Ways with city_id:",
		waysData.rows.filter((r) => r.city_id).length,
	);
	console.log(
		"Ways with cycleway:",
		waysData.rows.filter((r) => r.has_cycleway).length,
	);
	console.log("Sample:", waysData.rows.slice(0, 3));

	const cities: {
		[key: string]: Array<{
			length: number;
			hasCycleway: boolean;
			relationId: number;
			pdcTypology: string;
			cyclewayTypology: string;
		}>;
	} = {};

	waysData.rows.forEach((row: Record<string, unknown>) => {
		const cityId = row.city_id?.toString() || "2611606";
		if (!cities[cityId]) {
			cities[cityId] = [];
		}
		cities[cityId].push({
			length: parseFloat(String(row.length)) || 0,
			hasCycleway: row.has_cycleway === true,
			relationId: (row.relation_id as number) || 0,
			pdcTypology: row.pdc_typology as string,
			cyclewayTypology: row.cycleway_typology as string,
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

	console.log("PDC Cities found:", allPdcCities.rows.length);

	const summaryByCity: {
		[key: string]: {
			pdc_feito: number;
			out_pdc: number;
			pdc_total: number;
			real_pdc: number;
			percent: number;
			real_percent: number;
		};
	} = {};

	// Processar cidades com dados
	for (const city in cities) {
		if (Object.hasOwn(cities, city) && city !== "0") {
			const cityData = cities[city];
			const citySummary = generateCitySummary(cityData || []);
			summaryByCity[city] = citySummary;
		}
	}

	// Adicionar cidades PDC sem dados (zeros)
	allPdcCities.rows.forEach((cityRow: Record<string, unknown>) => {
		const cityId = (cityRow.city_id as number).toString();
		if (!summaryByCity[cityId]) {
			summaryByCity[cityId] = {
				pdc_feito: 0,
				out_pdc: 0,
				pdc_total: 0,
				real_pdc: 0,
				percent: 0,
				real_percent: 0,
			};
		}
	});

	const allCityData = Object.values(cities).flat();
	const allCitySummary = generateCitySummary(allCityData || []);

	return c.json({ all: allCitySummary, byCity: summaryByCity });
};

function generateCitySummary(
	cityData: Array<{
		length: number;
		hasCycleway: boolean;
		relationId: number;
		pdcTypology: string;
		cyclewayTypology: string;
	}>,
) {
	const newData = cityData.map((d) => {
		const hasCycleway = d.hasCycleway === true;
		const isNotOutPDC = d.relationId !== 0; // 0 = não PDC, >0 = PDC

		const pdc_realizado_designado =
			hasCycleway && isNotOutPDC && d.pdcTypology === d.cyclewayTypology
				? d.length
				: 0;
		const pdc_realizado_nao_designado =
			hasCycleway && isNotOutPDC && d.pdcTypology !== d.cyclewayTypology
				? d.length
				: 0;
		const realizado_fora_pdc = hasCycleway && !isNotOutPDC ? d.length : 0;
		const pdc_nao_realizado = !hasCycleway && isNotOutPDC ? d.length : 0;

		return {
			pdc_realizado_designado,
			pdc_realizado_nao_designado,
			realizado_fora_pdc,
			pdc_nao_realizado,
		};
	});

	const kms = newData.reduce(
		(accumulator, currentData) => {
			accumulator.pdc_realizado_designado +=
				currentData.pdc_realizado_designado;
			accumulator.pdc_realizado_nao_designado +=
				currentData.pdc_realizado_nao_designado;
			accumulator.realizado_fora_pdc += currentData.realizado_fora_pdc;
			accumulator.pdc_nao_realizado += currentData.pdc_nao_realizado;
			return accumulator;
		},
		{
			pdc_realizado_designado: 0,
			pdc_realizado_nao_designado: 0,
			realizado_fora_pdc: 0,
			pdc_nao_realizado: 0,
		},
	);

	const pdc_total =
		kms.pdc_realizado_designado +
		kms.pdc_realizado_nao_designado +
		kms.pdc_nao_realizado;
	const pdc_realizado_total =
		kms.pdc_realizado_designado + kms.pdc_realizado_nao_designado;
	const percent_realizado = pdc_total > 0 ? pdc_realizado_total / pdc_total : 0;
	const percent_designado =
		pdc_realizado_total > 0
			? kms.pdc_realizado_designado / pdc_realizado_total
			: 0;

	return {
		pdc_feito: pdc_realizado_total,
		out_pdc: kms.realizado_fora_pdc,
		pdc_total,
		real_pdc: pdc_realizado_total,
		percent: percent_realizado,
		real_percent: percent_designado,
	};
}

export const getAll = async (c: any) => {
	const { city, limit, offset, simplify, precision, minimal, only_all } =
		c.req.valid("query");
	const db = c.get("db");

	// Parse parameters
	const offsetNum = offset ? parseInt(offset, 10) : 0;
	const precisionNum = precision
		? parseInt(precision, 10)
		: env.GEOJSON_PRECISION;
	const isMinimal = minimal === "true";

	// Query com geometria original ou simplificada + precisão
	const baseGeometry = simplify
		? `ST_Simplify(prw.coordinates, ${parseFloat(simplify)})`
		: `prw.coordinates`;
	const geometryField = `ST_AsGeoJSON(${baseGeometry}, ${precisionNum}) as geometry`;

	let query = `
		SELECT 
			prw.id,
			prw.osm_id,
			${isMinimal ? "" : "prw.name,"}
			${geometryField},
			prw.osm_properties->>'has_cycleway' as has_cycleway,
			prw.osm_properties->>'pdc_typology' as pdc_typology,
			prw.osm_properties->>'cycleway_typology' as cycleway_typology,
			prw.relation_id,
			(prw.osm_properties->>'length')::float as length,
			COALESCE(circ.city_id, (prw.osm_properties->>'city_id')::int) as city_id
		FROM pdc_relation_ways prw
		LEFT JOIN cyclist_infra_relation_cities circ ON prw.relation_id = circ.relation_id
	`;

	if (city) {
		query += ` WHERE COALESCE(circ.city_id, (prw.osm_properties->>'city_id')::int) = ${parseInt(city, 10)}`;
	}

	query += ` ORDER BY prw.id`;

	if (limit) {
		const limitNum = Math.min(parseInt(limit, 10), env.MAX_WAYS_RESULTS);
		query += ` LIMIT ${limitNum}`;
	}

	if (offset) {
		query += ` OFFSET ${offsetNum}`;
	}

	const result = await db.execute(query);
	const ways = result.rows as Record<string, unknown>[];

	// Convert to GeoJSON format
	const features = ways.map((way: Record<string, unknown>) => {
		const hasCycleway = way.has_cycleway === "true";
		const isNotOutPDC = ((way.relation_id as number) || 0) !== 0;
		const length = parseFloat(String(way.length)) || 0;

		if (isMinimal) {
			// Determinar status exclusivo da via
			let status_type: string;
			let status_value: number;

			// Verificar se a tipologia está correta (precisa dos dados do banco)
			const pdcTypology = way.pdc_typology as string;
			const cyclewayTypology = way.cycleway_typology as string;

			if (hasCycleway && isNotOutPDC && pdcTypology === cyclewayTypology) {
				// Realizado dentro do PDC com infra designada
				status_type = "pdc_realizado_designado";
				status_value = length;
			} else if (
				hasCycleway &&
				isNotOutPDC &&
				pdcTypology !== cyclewayTypology
			) {
				// Realizado dentro do PDC com infra não designada
				status_type = "pdc_realizado_nao_designado";
				status_value = length;
			} else if (hasCycleway && !isNotOutPDC) {
				// Realizado fora do PDC
				status_type = "realizado_fora_pdc";
				status_value = length;
			} else if (!hasCycleway && isNotOutPDC) {
				// PDC não realizado
				status_type = "pdc_nao_realizado";
				status_value = length;
			} else {
				// Não é PDC e não tem ciclovia
				status_type = "unknown";
				status_value = 0;
			}

			return {
				type: "Feature" as const,
				geometry: way.geometry ? JSON.parse(way.geometry as string) : null,
				properties: {
					id: way.id,
					status_type,
					status_value,
					length,
				},
			};
		} else {
			const status = hasCycleway ? "Realizada" : "Projeto";

			return {
				type: "Feature" as const,
				geometry: way.geometry ? JSON.parse(way.geometry as string) : null,
				properties: {
					STATUS: status,
					id: way.id,
					osm_id: way.osm_id,
					name: way.name || null,
					pdc_typology: way.pdc_typology || null,
				},
			};
		}
	});

	if (city) {
		// Se filtrou por cidade, retorna apenas essa cidade (sem duplicar em 'all')
		return c.json({
			all: {
				type: "FeatureCollection" as const,
				features: [],
			},
			byCity: {
				[city]: {
					type: "FeatureCollection" as const,
					features,
				},
			},
		});
	}

	// Agrupa por cidade quando não há filtro
	const byCity: {
		[key: string]: { type: "FeatureCollection"; features: typeof features };
	} = {};
	features.forEach((feature) => {
		const cityId =
			(feature.properties as { city_id?: unknown }).city_id?.toString() ||
			"unknown";
		if (!byCity[cityId]) {
			byCity[cityId] = {
				type: "FeatureCollection" as const,
				features: [],
			};
		}
		byCity[cityId].features.push(feature);
	});

	// Se only_all=true, retorna apenas o 'all'
	if (only_all === "true") {
		return c.json({
			type: "FeatureCollection" as const,
			features,
		});
	}

	return c.json({
		all: {
			type: "FeatureCollection" as const,
			features,
		},
		byCity,
	});
};

export const getNearby = async (c: any) => {
	const { lat, lon, radius = "1000" } = c.req.valid("query");
	const db = c.get("db");

	const latitude = parseFloat(lat);
	const longitude = parseFloat(lon);
	const radiusMeters = parseInt(radius, 10);

	// Query PDC ways within radius with relation info and total length
	const result = await db.execute(`
		SELECT 
			prw.id,
			prw.osm_id,
			prw.name,
			prw.geojson,
			prw.osm_properties,
			cir.id as relation_id,
			cir.osm_id as relation_osm_id,
			cir.pdc_ref,
			cir.name as relation_name,
			cir.pdc_typology,
			cir.pdc_stretch,
			cir.pdc_km as relation_total_km,
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

	const ways = result.rows as Record<string, unknown>[];

	// Convert to GeoJSON features
	const features = ways.map((way) => ({
		type: "Feature" as const,
		id: way.osm_id,
		properties: {
			...((way.osm_properties as Record<string, unknown>) || {}),
			pdc_ref: way.pdc_ref,
			name: way.relation_name || way.name,
			pdc_typology: way.pdc_typology,
			description: way.pdc_stretch,
			executed: way.executed || false,
			length_km: parseFloat((Number(way.length_km) || 0).toFixed(3)),
			distance_meters: Math.round(Number(way.distance_meters) || 0),
			relation: way.relation_id
				? {
						id: way.relation_id,
						osm_id: way.relation_osm_id,
						pdc_ref: way.pdc_ref,
						name: way.relation_name,
						total_length_km: parseFloat(
							(Number(way.relation_total_km) || 0).toFixed(3),
						),
						description: way.pdc_stretch,
						typology: way.pdc_typology,
					}
				: null,
		},
		geometry: (way.geojson as { geometry?: unknown })?.geometry || null,
	}));

	// Calculate summary
	const totalWays = features.length;
	const executedWays = features.filter((f) => f.properties.executed).length;
	const totalLength = features.reduce(
		(sum, f) => sum + f.properties.length_km,
		0,
	);
	const executedLength = features
		.filter((f) => f.properties.executed)
		.reduce((sum, f) => sum + f.properties.length_km, 0);

	return c.json({
		type: "FeatureCollection" as const,
		features,
		summary: {
			total_ways: totalWays,
			executed_ways: executedWays,
			total_length_km: parseFloat(totalLength.toFixed(3)),
			executed_length_km: parseFloat(executedLength.toFixed(3)),
			execution_percentage:
				totalLength > 0
					? parseFloat(((executedLength / totalLength) * 100).toFixed(1))
					: 0,
		},
	});
};
