import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { closeDatabase, createConnectedDatabase } from "./connection.js";
import { bicycleRacks } from "./schemas/bicycle-racks/index.js";

interface GeoJSONFeature {
  type: "Feature";
  properties: Record<string, any>;
  geometry: {
    type: "Point" | "LineString" | "Polygon" | "MultiPolygon";
    coordinates: any;
  };
  id: string;
}

interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

function getPointFromGeometry(geometry: GeoJSONFeature["geometry"]): [number, number] | null {
  switch (geometry.type) {
    case "Point":
      return geometry.coordinates as [number, number];
    
    case "LineString":
      // Pega o ponto médio da linha
      const coords = geometry.coordinates as [number, number][];
      const midIndex = Math.floor(coords.length / 2);
      return coords[midIndex];
    
    case "Polygon":
      // Calcula centroide simples do primeiro anel
      const ring = geometry.coordinates[0] as [number, number][];
      let sumLng = 0, sumLat = 0;
      for (const [lng, lat] of ring) {
        sumLng += lng;
        sumLat += lat;
      }
      return [sumLng / ring.length, sumLat / ring.length];
    
    default:
      return null;
  }
}

async function seedBicycleRacksFromGeoJSON() {
  const db = await createConnectedDatabase();
  
  try {
    // Lê o arquivo GeoJSON
    const geojsonPath = join(process.cwd(), "../../apps/bicycle-racks/src/db/bicicletarios-brasil.geojson");
    const geojsonData = readFileSync(geojsonPath, "utf-8");
    const geojson: GeoJSONFeatureCollection = JSON.parse(geojsonData);

    console.log(`📍 Processando ${geojson.features.length} features do GeoJSON...`);

    const bicycleRacksData = [];

    for (const feature of geojson.features) {
      const props = feature.properties;
      
      // Só processa se tem amenity=bicycle_parking ou bicycle_parking definido
      if (!props.amenity?.includes("bicycle_parking") && !props.bicycle_parking) {
        continue;
      }

      // Extrai coordenadas (ponto ou centroide)
      const point = getPointFromGeometry(feature.geometry);
      if (!point) continue;

      const [lng, lat] = point;
      const wktPoint = `POINT(${lng} ${lat})`;

      bicycleRacksData.push({
        osm_id: props["@id"] || feature.id,
        osm_type: props["@id"]?.split("/")[0] || "unknown",
        coordinates: wktPoint,
        name: props.name || null,
        description: props.description || null,
        amenity: props.amenity || "bicycle_parking",
        bicycle_parking: props.bicycle_parking || null,
        capacity: props.capacity || null,
        access: props.access || null,
        covered: props.covered || null,
        fee: props.fee || null,
        supervised: props.supervised || null,
        lit: props.lit || null,
        operator: props.operator || null,
        operator_type: props.operator_type || null,
        building: props.building || null,
        level: props.level || null,
        surface: props.surface || null,
        addr_city: props["addr:city"] || null,
        addr_street: props["addr:street"] || null,
        addr_housenumber: props["addr:housenumber"] || null,
        addr_suburb: props["addr:suburb"] || null,
        addr_postcode: props["addr:postcode"] || null,
        opening_hours: props.opening_hours || null,
        payment_none: props.payment_none || null,
        ref: props.ref || null,
        source: props.source || null,
        source_date: props.source_date || null,
        wikidata: props.wikidata || null,
        wikipedia: props.wikipedia || null,
      });
    }

    console.log(`🚲 Inserindo ${bicycleRacksData.length} bicicletários...`);

    // Insere em lotes
    const batchSize = 100;
    for (let i = 0; i < bicycleRacksData.length; i += batchSize) {
      const batch = bicycleRacksData.slice(i, i + batchSize);
      await db.insert(bicycleRacks).values(batch);
      console.log(`✅ Inserido lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(bicycleRacksData.length / batchSize)}`);
    }

    console.log(`🎉 Seed concluído! ${bicycleRacksData.length} bicicletários inseridos.`);
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