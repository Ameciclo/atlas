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
	const lines: string[] = [];
	let currentLine = "";
	let inQuotes = false;
	
	// Parse CSV properly handling quoted fields with line breaks
	for (let i = 0; i < content.length; i++) {
		const char = content[i];
		
		if (char === '"') {
			inQuotes = !inQuotes;
		}
		
		if (char === '\n' && !inQuotes) {
			lines.push(currentLine.trim());
			currentLine = "";
		} else {
			currentLine += char;
		}
	}
	
	// Add last line if exists
	if (currentLine.trim()) {
		lines.push(currentLine.trim());
	}
	
	const headers = lines[0]?.split(",").map(h => h.replace(/"/g, '').trim()) || [];
	
	return lines.slice(1).filter(line => line.trim()).map((line) => {
		const values: string[] = [];
		let currentValue = "";
		let inQuotes = false;
		
		// Parse values properly handling quoted fields
		for (let i = 0; i < line.length; i++) {
			const char = line[i];
			
			if (char === '"') {
				inQuotes = !inQuotes;
			} else if (char === ',' && !inQuotes) {
				values.push(currentValue.replace(/"/g, '').trim());
				currentValue = "";
			} else {
				currentValue += char;
			}
		}
		
		// Add last value
		values.push(currentValue.replace(/"/g, '').trim());
		
		const row: Record<string, string> = {};
		headers.forEach((header, i) => {
			row[header] = values[i] || "";
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

		const citiesToInsert = citiesData.map((city) => ({
			id: parseInt(city.id),
			name: city.name,
			state: city.state,
			full_state: city.full_state,
			rmr: city.rmr === "true",
		}));

		await db
			.insert(cyclingInfraSchema.cities)
			.values(citiesToInsert)
			.onConflictDoNothing();
		console.log(`✅ Inserted ${citiesToInsert.length} cities\n`);

		// 2. Seed Relations
		console.log("🔗 Loading relations...");
		const relationsContent = await readFile(
			join(dataPath, "relations.csv"),
			"utf-8",
		);
		const relationsData = parseCSV(
			relationsContent,
		) as unknown as CSVRelation[];

		console.log(`Found ${relationsData.length} relations`);

		const relationsToInsert = relationsData.map((rel) => ({
			osm_id: rel.osm_id && rel.osm_id.trim() !== "" ? rel.osm_id : null,
			pdc_ref: rel.pdc_ref && rel.pdc_ref.trim() !== "" ? rel.pdc_ref : null,
			pdc_typology:
				rel.pdc_typology && rel.pdc_typology.trim() !== ""
					? rel.pdc_typology
					: null,
			name: rel.name && rel.name.trim() !== "" ? rel.name : null,
			pdc_stretch:
				rel.pdc_stretch && rel.pdc_stretch.trim() !== ""
					? rel.pdc_stretch
					: null,
			pdc_cities:
				rel.pdc_cities && rel.pdc_cities.trim() !== "" ? rel.pdc_cities : null,
			pdc_notes:
				rel.pdc_notes && rel.pdc_notes.trim() !== "" ? rel.pdc_notes : null,
			notes: rel.notes && rel.notes.trim() !== "" ? rel.notes : null,
			pdc_km:
				rel.pdc_km && rel.pdc_km.trim() !== "" ? parseFloat(rel.pdc_km) : null,
		}));

		await db
			.insert(cyclingInfraSchema.cyclistInfraRelations)
			.values(relationsToInsert)
			.onConflictDoNothing();
		console.log(`✅ Inserted ${relationsToInsert.length} relations\n`);

		// 2.5. Seed Relation-Cities relationships
		console.log("🔗 Loading relation-cities...");
		const relationCitiesContent = await readFile(
			join(dataPath, "relations_cities.csv"),
			"utf-8"
		);
		const relationCitiesData = parseCSV(relationCitiesContent);

		console.log(`Found ${relationCitiesData.length} relation-city rows`);
		console.log('First few rows:', relationCitiesData.slice(0, 3));

		const relationCitiesToInsert = relationCitiesData
			.map(row => {
				// Clean up keys and values from \r characters
				const cleanRow: Record<string, string> = {};
				for (const [key, value] of Object.entries(row)) {
					const cleanKey = key.replace(/\r/g, '');
					const cleanValue = value.replace(/\r/g, '');
					cleanRow[cleanKey] = cleanValue;
				}
				return cleanRow;
			})
			.filter(row => row.relation_id && row.city_id && row.relation_id.trim() !== "" && row.city_id.trim() !== "")
			.map(row => ({
				relation_id: parseInt(row.relation_id!),
				city_id: parseInt(row.city_id!)
			}))
			.filter(row => !isNaN(row.relation_id) && !isNaN(row.city_id));

		if (relationCitiesToInsert.length === 0) {
			console.log('⚠️ No valid relation-city relationships to insert');
			return;
		}

		await db
			.insert(cyclingInfraSchema.cyclistInfraRelationCities)
			.values(relationCitiesToInsert)
			.onConflictDoNothing();

		console.log(`✅ Inserted ${relationCitiesToInsert.length} relation-city relationships\n`);

		// 3. Seed Ways (PDC Relations)
		console.log("🛣️ Loading ways...");
		const waysContent = await readFile(join(dataPath, "ways.geojson"), "utf-8");
		const waysData: GeoJSONCollection = JSON.parse(waysContent);

		console.log(`Found ${waysData.features.length} ways features`);

		// Get all relations to match relation_id
		const allRelations = await db.select().from(cyclingInfraSchema.cyclistInfraRelations);
		const relationMap = new Map(allRelations.map(r => [r.osm_id, r.id]));

		const waysToInsert = waysData.features.map((feature) => {
			const osmId = feature.properties["@id"] || "";
			// Extract relation ID from way's osm_id (e.g., "relation/16000464" -> find matching relation)
			let relationId = null;
			if (osmId.startsWith("relation/")) {
				relationId = relationMap.get(osmId) || null;
			}

			return {
				osm_id: osmId,
				relation_id: relationId,
				geometry_type: feature.geometry.type,
				coordinates: JSON.stringify(feature.geometry), // Full geometry object for ST_GeomFromGeoJSON
				osm_properties: feature.properties,
				geojson: feature,
			};
		});

		// Insert in batches
		const batchSize = 1000;
		for (let i = 0; i < waysToInsert.length; i += batchSize) {
			const batch = waysToInsert.slice(i, i + batchSize);
			await db
				.insert(cyclingInfraSchema.pdcRelationWays)
				.values(batch)
				.onConflictDoNothing();
			console.log(
				`  ✓ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(waysToInsert.length / batchSize)}`,
			);
		}
		console.log(`✅ Inserted ${waysToInsert.length} ways\n`);

		// 4. Seed Ciclomapa (filtered)
		console.log("🚴 Loading ciclomapa...");
		const ciclomapaContent = await readFile(
			join(dataPath, "ciclomapa-Recife, Pernambuco, Brasil.geojson"),
			"utf-8",
		);
		const ciclomapaData: GeoJSONCollection = JSON.parse(ciclomapaContent);

		// Filter: only LineString + cycling infrastructure types
		const cyclingTypes = [
			"Ciclovia",
			"Ciclofaixa",
			"Ciclorrota",
			"Calçada compartilhada",
		];
		const filteredFeatures = ciclomapaData.features.filter(
			(feature) =>
				feature.geometry.type === "LineString" &&
				cyclingTypes.includes(feature.properties.type),
		);

		console.log(`Found ${ciclomapaData.features.length} total features`);
		console.log(
			`Filtered to ${filteredFeatures.length} cycling infrastructure LineStrings`,
		);

		const ciclomapaToInsert = filteredFeatures.map((feature) => ({
			osm_id: feature.properties.id || "",
			name: feature.properties.name || null,
			infra_type: feature.properties.type,
			coordinates: JSON.stringify(feature.geometry), // Full geometry object for ST_GeomFromGeoJSON
			geojson: feature,
		}));

		// Insert in batches
		for (let i = 0; i < ciclomapaToInsert.length; i += batchSize) {
			const batch = ciclomapaToInsert.slice(i, i + batchSize);
			await db
				.insert(cyclingInfraSchema.ciclomapaInfra)
				.values(batch)
				.onConflictDoNothing();
			console.log(
				`  ✓ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(ciclomapaToInsert.length / batchSize)}`,
			);
		}
		console.log(`✅ Inserted ${ciclomapaToInsert.length} ciclomapa features\n`);

		console.log("✅ Cycling infrastructure seed completed successfully!");

		return {
			cities: citiesToInsert.length,
			relations: relationsToInsert.length,
			relationCities: relationCitiesToInsert.length,
			ways: waysToInsert.length,
			ciclomapa: ciclomapaToInsert.length,
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
