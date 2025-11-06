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

interface CSVWay {
	osm_id: string;
	name: string;
	length: string;
	highway: string;
	has_cycleway: string;
	cycleway_typology: string;
	relation_id: string;
	geojson: string;
	lastupdated: string;
	city_id: string;
	dual_carriageway: string;
	pdc_typology: string;
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

		// 3. Seed Ways (Processed OSM Data)
		console.log("🛣️ Loading processed ways...");
		const waysContent = await readFile(join(dataPath, "pdc_ways.json"), "utf-8");
		const waysData = JSON.parse(waysContent);

		console.log(`Found ${waysData.length} processed ways`);

		// Get all relations to match relation_id
		const allRelations = await db.select().from(cyclingInfraSchema.cyclistInfraRelations);
		console.log(`Found ${allRelations.length} relations in DB`);
		console.log('Sample relations:', allRelations.slice(0, 3).map(r => ({ id: r.id, osm_id: r.osm_id })));

		const relationMap = new Map(allRelations.map(r => [r.osm_id, r.id]));
		console.log('RelationMap keys:', Array.from(relationMap.keys()).slice(0, 5));
		console.log('Sample way relation_ids:', waysData.slice(0, 5).map(w => w.relation_id));

		const waysToInsert = waysData.map((way: any) => {
			// Parse GeoJSON from string (it's double-encoded)
			const geojsonData = JSON.parse(way.geojson);
			const geometry = geojsonData.features[0].geometry;
			
			// Find relation by relation_id from JSON
			let relationId = null;
			if (way.relation_id && way.relation_id !== 0 && way.relation_id !== "0") {
				// Find relation by matching the relation_id from our processed data
				relationId = relationMap.get(way.relation_id) || null;
				
				// Debug first few
				if (waysData.indexOf(way) < 3) {
					console.log(`Way ${way.osm_id}: relation_id=${way.relation_id} found=${relationId}`);
				}
			}


			return {
				osm_id: `way/${way.osm_id}`,
				relation_id: relationId,
				name: way.name || null,
				geometry_type: geometry?.type || "LineString",
				coordinates: geometry ? JSON.stringify(geometry) : null,
				osm_properties: {
					length: way.length,
					highway: way.highway,
					has_cycleway: way.has_cycleway,
					cycleway_typology: way.cycleway_typology,
					city_id: way.city_id,
					dual_carriageway: way.dual_carriageway,
					pdc_typology: way.pdc_typology,
					lastupdated: way.lastupdated
				},
				geojson: geojsonData,
			};
		}).filter(way => way.coordinates !== null);

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

		// 4. Seed Non-PDC Ways (existing cycling infrastructure)
		console.log("🚴 Loading non-PDC ways...");
		const nonPdcContent = await readFile(join(dataPath, "non_pdc_ways.json"), "utf-8");
		const nonPdcData = JSON.parse(nonPdcContent);

		console.log(`Found ${nonPdcData.length} non-PDC ways`);

		const nonPdcToInsert = nonPdcData.map((way: any) => {
			// Parse GeoJSON from string
			const geojsonData = JSON.parse(way.geojson);
			const geometry = geojsonData.features[0].geometry;

			return {
				osm_id: `way/${way.osm_id}`,
				relation_id: null, // Non-PDC = null relation_id
				name: way.name || null,
				geometry_type: geometry?.type || "LineString",
				coordinates: JSON.stringify(geometry),
				osm_properties: {
					length: way.length,
					highway: way.highway,
					has_cycleway: way.has_cycleway,
					cycleway_typology: way.cycleway_typology,
					city_id: way.city_id,
					dual_carriageway: way.dual_carriageway,
					pdc_typology: way.pdc_typology,
					lastupdated: way.lastupdated
				},
				geojson: geojsonData,
			};
		});

		// Insert in batches
		for (let i = 0; i < nonPdcToInsert.length; i += batchSize) {
			const batch = nonPdcToInsert.slice(i, i + batchSize);
			await db
				.insert(cyclingInfraSchema.pdcRelationWays)
				.values(batch)
				.onConflictDoNothing();
			console.log(
				`  ✓ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(nonPdcToInsert.length / batchSize)}`,
			);
		}
		console.log(`✅ Inserted ${nonPdcToInsert.length} non-PDC ways\n`);

		// 5. Seed Ciclomapa Infrastructure
		console.log("🚴 Loading ciclomapa data...");
		const ciclomapaFiles = [
			"ciclomapa-Recife, Pernambuco, Brasil.geojson",
			"ciclomapa-Olinda, Pernambuco, Brasil.geojson",
			"ciclomapa-Paulista, Pernambuco, Brasil.geojson",
			"ciclomapa-Camaragibe, Pernambuco, Brasil.geojson",
			"ciclomapa-São Lourenço da Mata, Pernambuco, Brasil.geojson",
			"ciclomapa-Abreu e Lima, Pernambuco, Brasil.geojson",
			"ciclomapa-Igarassu, Pernambuco, Brasil.geojson",
			"ciclomapa-Cabo de Santo Agostinho, Pernambuco, Brasil.geojson",
			"ciclomapa-Ipojuca, Pernambuco, Brasil.geojson"
		];

		const cyclingTypes = ["Ciclovia", "Ciclofaixa", "Ciclorrota", "Calçada compartilhada"];
		const ciclomapaFeatures = [];
		const osmIdsSeen = new Set();

		for (const filename of ciclomapaFiles) {
			try {
				const filePath = join(dataPath, filename);
				const content = await readFile(filePath, "utf-8");
				const geojsonData = JSON.parse(content);

				for (const feature of geojsonData.features) {
					if (feature.geometry?.type === "LineString" && 
						cyclingTypes.includes(feature.properties?.type)) {
						
						const osmId = feature.id;
						if (!osmId?.startsWith("way/") || osmIdsSeen.has(osmId)) {
							continue;
						}

						osmIdsSeen.add(osmId);
						ciclomapaFeatures.push({
							osm_id: osmId,
							name: feature.properties?.name || null,
							infra_type: feature.properties.type,
							coordinates: JSON.stringify(feature.geometry),
							geojson: feature
						});
					}
				}
				console.log(`  ✓ Processed ${filename}: ${geojsonData.features.length} features`);
			} catch (error) {
				console.log(`  ⚠️ Skipped ${filename}: ${error.message}`);
			}
		}

		console.log(`Found ${ciclomapaFeatures.length} unique ciclomapa features`);

		// Insert ciclomapa data in batches
		for (let i = 0; i < ciclomapaFeatures.length; i += batchSize) {
			const batch = ciclomapaFeatures.slice(i, i + batchSize);
			await db
				.insert(cyclingInfraSchema.ciclomapaInfra)
				.values(batch)
				.onConflictDoNothing();
			console.log(
				`  ✓ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(ciclomapaFeatures.length / batchSize)}`,
			);
		}
		console.log(`✅ Inserted ${ciclomapaFeatures.length} ciclomapa features\n`);

		console.log("✅ Cycling infrastructure seed completed successfully!");

		return {
			cities: citiesToInsert.length,
			relations: relationsToInsert.length,
			relationCities: relationCitiesToInsert.length,
			ways: waysToInsert.length,
			nonPdcWays: nonPdcToInsert.length,
			ciclomapa: ciclomapaFeatures.length,
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
