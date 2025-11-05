import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { DatabaseConfig } from "./connection.js";
import { closeDatabase, createConnectedDatabase } from "./connection.js";
import * as cyclingInfraSchema from "./schemas/cycling-infra/index.js";

const __dirname = new URL(".", import.meta.url).pathname;

interface CSVCity {
  id: string;
  name: string;
  state: string;
  full_state: string;
  rmr: string;
}

interface CSVRelation {
  id: string;
  osm_id: string;
  pdc_ref: string;
  pdc_typology: string;
  name: string;
  pdc_stretch: string;
  pdc_cities: string;
  pdc_notes: string;
  notes: string;
  pdc_km: string;
}

interface GeoJSONFeature {
  type: "Feature";
  properties: Record<string, any>;
  geometry: {
    type: string;
    coordinates: any;
  };
}

interface GeoJSONCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split('\n');
  const headers = lines[0]?.split(',') || [];
  
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = values[i] || '';
    });
    return row;
  });
}

export async function seedCyclingInfra(config: DatabaseConfig = {}) {
  const db = await createConnectedDatabase(config);

  try {
    console.log("🌱 Starting cycling infrastructure seed...\n");

    const dataPath = join(__dirname, "../../../apps/cycling-infra/src/db");

    // 1. Seed Cities
    console.log("📊 Loading cities...");
    const citiesContent = await readFile(join(dataPath, "cities.csv"), "utf-8");
    const citiesData = parseCSV(citiesContent) as unknown as CSVCity[];
    
    console.log(`Found ${citiesData.length} cities`);
    
    const citiesToInsert = citiesData.map(city => ({
      id: parseInt(city.id),
      name: city.name,
      state: city.state,
      full_state: city.full_state,
      rmr: city.rmr === 'true'
    }));

    await db.insert(cyclingInfraSchema.cities).values(citiesToInsert).onConflictDoNothing();
    console.log(`✅ Inserted ${citiesToInsert.length} cities\n`);

    // 2. Seed Relations
    console.log("🔗 Loading relations...");
    const relationsContent = await readFile(join(dataPath, "relations.csv"), "utf-8");
    const relationsData = parseCSV(relationsContent) as unknown as CSVRelation[];
    
    console.log(`Found ${relationsData.length} relations`);
    
    const relationsToInsert = relationsData.map(rel => ({
      osm_id: rel.osm_id && rel.osm_id.trim() !== '' ? rel.osm_id : null,
      pdc_ref: rel.pdc_ref && rel.pdc_ref.trim() !== '' ? rel.pdc_ref : null,
      pdc_typology: rel.pdc_typology && rel.pdc_typology.trim() !== '' ? rel.pdc_typology : null,
      name: rel.name && rel.name.trim() !== '' ? rel.name : null,
      pdc_stretch: rel.pdc_stretch && rel.pdc_stretch.trim() !== '' ? rel.pdc_stretch : null,
      pdc_cities: rel.pdc_cities && rel.pdc_cities.trim() !== '' ? rel.pdc_cities : null,
      pdc_notes: rel.pdc_notes && rel.pdc_notes.trim() !== '' ? rel.pdc_notes : null,
      notes: rel.notes && rel.notes.trim() !== '' ? rel.notes : null,
      pdc_km: rel.pdc_km && rel.pdc_km.trim() !== '' ? parseFloat(rel.pdc_km) : null
    }));

    await db.insert(cyclingInfraSchema.cyclistInfraRelations).values(relationsToInsert).onConflictDoNothing();
    console.log(`✅ Inserted ${relationsToInsert.length} relations\n`);

    // 3. Seed Ways (PDC Relations)
    console.log("🛣️ Loading ways...");
    const waysContent = await readFile(join(dataPath, "ways.geojson"), "utf-8");
    const waysData: GeoJSONCollection = JSON.parse(waysContent);
    
    console.log(`Found ${waysData.features.length} ways features`);
    
    const waysToInsert = waysData.features.map(feature => ({
      osm_id: feature.properties["@id"] || "",
      geometry_type: feature.geometry.type,
      coordinates: JSON.stringify(feature.geometry), // Full geometry object for ST_GeomFromGeoJSON
      osm_properties: feature.properties,
      geojson: feature
    }));

    // Insert in batches
    const batchSize = 1000;
    for (let i = 0; i < waysToInsert.length; i += batchSize) {
      const batch = waysToInsert.slice(i, i + batchSize);
      await db.insert(cyclingInfraSchema.pdcRelationWays).values(batch).onConflictDoNothing();
      console.log(`  ✓ Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(waysToInsert.length/batchSize)}`);
    }
    console.log(`✅ Inserted ${waysToInsert.length} ways\n`);

    // 4. Seed Ciclomapa (filtered)
    console.log("🚴 Loading ciclomapa...");
    const ciclomapaContent = await readFile(join(dataPath, "ciclomapa-Recife, Pernambuco, Brasil.geojson"), "utf-8");
    const ciclomapaData: GeoJSONCollection = JSON.parse(ciclomapaContent);
    
    // Filter: only LineString + cycling infrastructure types
    const cyclingTypes = ['Ciclovia', 'Ciclofaixa', 'Ciclorrota', 'Calçada compartilhada'];
    const filteredFeatures = ciclomapaData.features.filter(feature => 
      feature.geometry.type === 'LineString' && 
      cyclingTypes.includes(feature.properties.type)
    );
    
    console.log(`Found ${ciclomapaData.features.length} total features`);
    console.log(`Filtered to ${filteredFeatures.length} cycling infrastructure LineStrings`);
    
    const ciclomapaToInsert = filteredFeatures.map(feature => ({
      osm_id: feature.properties.id || "",
      name: feature.properties.name || null,
      infra_type: feature.properties.type,
      coordinates: JSON.stringify(feature.geometry), // Full geometry object for ST_GeomFromGeoJSON
      geojson: feature
    }));

    // Insert in batches
    for (let i = 0; i < ciclomapaToInsert.length; i += batchSize) {
      const batch = ciclomapaToInsert.slice(i, i + batchSize);
      await db.insert(cyclingInfraSchema.ciclomapaInfra).values(batch).onConflictDoNothing();
      console.log(`  ✓ Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(ciclomapaToInsert.length/batchSize)}`);
    }
    console.log(`✅ Inserted ${ciclomapaToInsert.length} ciclomapa features\n`);

    console.log("✅ Cycling infrastructure seed completed successfully!");
    
    return {
      cities: citiesToInsert.length,
      relations: relationsToInsert.length,
      ways: waysToInsert.length,
      ciclomapa: ciclomapaToInsert.length
    };

  } catch (error) {
    console.error("❌ Error seeding cycling infrastructure:", error);
    throw error;
  } finally {
    await closeDatabase(db);
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  seedCyclingInfra().catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
}