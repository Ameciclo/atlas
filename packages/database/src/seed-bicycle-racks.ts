import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { closeDatabase, createConnectedDatabase } from "./connection.js";
import { bicycleRacks } from "./schemas/bicycle-racks/index.js";

interface GeoJSONFeature {
	type: "Feature";
	properties: Record<string, string | number | boolean | null>;
	geometry: {
		type: "Point" | "LineString" | "Polygon" | "MultiPolygon";
		coordinates: number[] | number[][] | number[][][];
	};
	id: string;
}

interface GeoJSONFeatureCollection {
	type: "FeatureCollection";
	features: GeoJSONFeature[];
}

function getPointFromGeometry(
	geometry: GeoJSONFeature["geometry"],
): [number, number] | null {
	switch (geometry.type) {
		case "Point":
			return geometry.coordinates as [number, number];

		case "LineString": {
			// Pega o ponto médio da linha
			const coords = geometry.coordinates as [number, number][];
			if (coords.length === 0) return null;
			const midIndex = Math.floor(coords.length / 2);
			return coords[midIndex] || null;
		}

		case "Polygon": {
			// Calcula centroide simples do primeiro anel
			const ring = (geometry.coordinates as number[][][])[0];
			if (!ring || ring.length === 0) return null;
			let sumLng = 0,
				sumLat = 0;
			for (const coord of ring) {
				if (coord && coord.length >= 2) {
					sumLng += coord[0];
					sumLat += coord[1];
				}
			}
			return [sumLng / ring.length, sumLat / ring.length];
		}

		default:
			return null;
	}
}

async function seedBicycleRacksFromGeoJSON() {
	const db = await createConnectedDatabase();

	try {
		// Lê o arquivo GeoJSON
		const geojsonPath = join(
			process.cwd(),
			"../../apps/bicycle-racks/src/db/bicicletarios-brasil.geojson",
		);
		const geojsonData = readFileSync(geojsonPath, "utf-8");
		const geojson: GeoJSONFeatureCollection = JSON.parse(geojsonData);

		console.log(
			`📍 Processando ${geojson.features.length} features do GeoJSON...`,
		);

		const bicycleRacksData = [];

		for (const feature of geojson.features) {
			const props = feature.properties;

			// Só processa se tem amenity=bicycle_parking ou bicycle_parking definido
			if (
				!(typeof props.amenity === "string" && props.amenity.includes("bicycle_parking")) &&
				!props.bicycle_parking
			) {
				continue;
			}

			// Extrai coordenadas (ponto ou centroide)
			const point = getPointFromGeometry(feature.geometry);
			if (!point) continue;

			const [lng, lat] = point;
			const wktPoint = `POINT(${lng} ${lat})`;

			bicycleRacksData.push({
				osm_id: (props["@id"] as string) || feature.id,
				osm_type: (typeof props["@id"] === "string" ? props["@id"].split("/")[0] : null) || "unknown",
				coordinates: wktPoint,
				name: (props.name as string) || null,
				description: (props.description as string) || null,
				amenity: (props.amenity as string) || "bicycle_parking",
				bicycle_parking: (props.bicycle_parking as string) || null,
				capacity: (props.capacity as string) || null,
				access: (props.access as string) || null,
				covered: (props.covered as string) || null,
				fee: (props.fee as string) || null,
				supervised: (props.supervised as string) || null,
				lit: (props.lit as string) || null,
				operator: (props.operator as string) || null,
				operator_type: (props.operator_type as string) || null,
				building: (props.building as string) || null,
				level: (props.level as string) || null,
				surface: (props.surface as string) || null,
				addr_city: (props["addr:city"] as string) || null,
				addr_street: (props["addr:street"] as string) || null,
				addr_housenumber: (props["addr:housenumber"] as string) || null,
				addr_suburb: (props["addr:suburb"] as string) || null,
				addr_postcode: (props["addr:postcode"] as string) || null,
				opening_hours: (props.opening_hours as string) || null,
				payment_none: (props.payment_none as string) || null,
				ref: (props.ref as string) || null,
				source: (props.source as string) || null,
				source_date: (props.source_date as string) || null,
				wikidata: (props.wikidata as string) || null,
				wikipedia: (props.wikipedia as string) || null,
			});
		}

		console.log(`🚲 Inserindo ${bicycleRacksData.length} bicicletários...`);

		// Insere em lotes
		const batchSize = 100;
		for (let i = 0; i < bicycleRacksData.length; i += batchSize) {
			const batch = bicycleRacksData.slice(i, i + batchSize);
			await db.insert(bicycleRacks).values(batch);
			console.log(
				`✅ Inserido lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(bicycleRacksData.length / batchSize)}`,
			);
		}

		console.log(
			`🎉 Seed concluído! ${bicycleRacksData.length} bicicletários inseridos.`,
		);
	} catch (error) {
		console.error("❌ Erro no seed:", error);
		process.exit(1);
	} finally {
		await closeDatabase(db);
	}
}

// Executa se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
	seedBicycleRacksFromGeoJSON();
}

export { seedBicycleRacksFromGeoJSON };
