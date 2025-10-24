import { readFileSync } from "fs";
import { join } from "path";
import { createConnectedDatabase, closeDatabase } from "./connection.js";
import { bicycleRacks } from "./schemas/bicycle-racks/index.js";

async function seedBicycleRacks() {
  console.log("🚴 Seeding bicycle racks...");
  
  const db = await createConnectedDatabase();

  try {
    // Ler o arquivo GPX (temporariamente usando dados mock)
    // const gpxPath = join(process.cwd(), "../../apps/bicycle-racks/src/db/bicicletarios-brasil.gpx");
    // TODO: Implementar parser GPX ou usar dados GeoJSON
    
    // Dados mock para teste
    const mockData = {
      features: [
        {
          properties: {
            "@id": "node/1120614474",
            amenity: "bicycle_parking",
            name: "bicicletário da CHESF",
            capacity: "30",
            covered: "no",
            access: "permissive"
          },
          geometry: {
            type: "Point",
            coordinates: [-34.9305952, -8.0653027]
          }
        }
      ]
    };
    
    const geojsonData = mockData;

    const bicycleRacksData = geojsonData.features
      .filter((feature: any) => feature.properties.amenity === "bicycle_parking")
      .map((feature: any) => {
        const props = feature.properties;
        const coords = feature.geometry.coordinates;
        
        return {
          osm_id: props["@id"],
          osm_type: props["@id"]?.startsWith("node/") ? "node" : "way",
          name: props.name || null,
          description: props.description || null,
          amenity: props.amenity,
          bicycle_parking: props.bicycle_parking || null,
          capacity: props.capacity || null,
          access: props.access || null,
          covered: props.covered || null,
          fee: props.fee || null,
          supervised: props.supervised || null,
          lit: props.lit || null,
          operator: props.operator || null,
          operator_type: props["operator:type"] || null,
          ref: props.ref || null,
          level: props.level || null,
          surface: props.surface || null,
          building: props.building || null,
          payment_none: props["payment:none"] || null,
          source: props.source || null,
          source_date: props["source:date"] || null,
          latitude: feature.geometry.type === "Point" ? coords[1] : null,
          longitude: feature.geometry.type === "Point" ? coords[0] : null,
          metadata: {
            geometry_type: feature.geometry.type,
            original_properties: props
          }
        };
      });

    // Inserir dados
    await db.insert(bicycleRacks).values(bicycleRacksData);
    
    console.log(`✅ Inserted ${bicycleRacksData.length} bicycle racks`);
  } catch (error) {
    console.error("❌ Error seeding bicycle racks:", error);
    throw error;
  } finally {
    await closeDatabase(db);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedBicycleRacks()
    .then(() => {
      console.log("🎉 Bicycle racks seeding completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Seeding failed:", error);
      process.exit(1);
    });
}

export { seedBicycleRacks };