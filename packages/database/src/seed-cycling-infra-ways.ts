import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { DatabaseConfig } from "./connection.js";
import { closeDatabase, createConnectedDatabase } from "./connection.js";
import * as cyclingInfraSchema from "./schemas/cycling-infra/index.js";

const __dirname = new URL(".", import.meta.url).pathname;

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

function parseCSV(content: string): Record<string, string>[] {
	const lines: string[] = [];
	let currentLine = "";
	let inQuotes = false;
	
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
	
	if (currentLine.trim()) {
		lines.push(currentLine.trim());
	}
	
	const headers = lines[0]?.split(",").map(h => h.replace(/"/g, '').trim()) || [];
	
	return lines.slice(1).filter(line => line.trim()).map((line) => {
		const values: string[] = [];
		let currentValue = "";
		let inQuotes = false;
		
		for (let i = 0; i < line.length; i++) {
			const char = line[i];
			
			if (char === '"') {
				inQuotes = !inQuotes;
			} else if (char === ',' && !inQuotes) {
				// Não remover aspas do conteúdo, só das bordas
				let cleanValue = currentValue.trim();
				if (cleanValue.startsWith('"') && cleanValue.endsWith('"')) {
					cleanValue = cleanValue.slice(1, -1);
				}
				values.push(cleanValue);
				currentValue = "";
			} else {
				currentValue += char;
			}
		}
		
		// Add last value
		let cleanValue = currentValue.trim();
		if (cleanValue.startsWith('"') && cleanValue.endsWith('"')) {
			cleanValue = cleanValue.slice(1, -1);
		}
		values.push(cleanValue);
		
		const row: Record<string, string> = {};
		headers.forEach((header, i) => {
			row[header] = values[i] || "";
		});
		return row;
	});
}

export async function seedCyclingInfraWays(config: DatabaseConfig = {}) {
	const db = await createConnectedDatabase(config);

	try {
		console.log("🌱 Starting cycling infra ways seed...\n");

		const dataPath = join(__dirname, "../../../apps/cycling-infra/src/db");

		// Seed Ways from CSV
		console.log("🛣️ Loading ways from CSV...");
		const waysContent = await readFile(join(dataPath, "ways.csv"), "utf-8");
		const waysData = parseCSV(waysContent) as unknown as CSVWay[];

		console.log(`Found ${waysData.length} ways in CSV`);

		// Clear existing ways
		await db.delete(cyclingInfraSchema.pdcRelationWays);
		console.log("✅ Cleared existing ways");

		const waysToInsert = waysData
			.filter(w => w.osm_id && w.osm_id.trim() !== "")
			.map((way) => {
				let parsedGeojson = { type: "FeatureCollection", features: [] };
				let coordinates = "{}";
				
				if (way.geojson && way.geojson.trim()) {
					try {
						// Tentar diferentes formas de corrigir o JSON
						let fixedJson = way.geojson;
						
						// Corrigir aspas duplas escapadas
						if (fixedJson.includes('""')) {
							fixedJson = fixedJson.replace(/""/g, '"');
						}
						
						parsedGeojson = JSON.parse(fixedJson);
						coordinates = fixedJson;
					} catch (e) {
						// Silenciosamente usar fallback
					}
				}
				
				return {
					osm_id: `way/${way.osm_id}`,
					relation_id: way.relation_id && way.relation_id.trim() !== "" && way.relation_id !== "0" 
						? parseInt(way.relation_id) : null,
					name: way.name || null,
					geometry_type: "LineString",
					coordinates: coordinates,
					osm_properties: {
						osm_id: parseInt(way.osm_id),
						name: way.name,
						length: parseFloat(way.length) || 0,
						highway: way.highway,
						has_cycleway: way.has_cycleway === "true",
						cycleway_typology: way.cycleway_typology,
						city_id: way.city_id ? parseInt(way.city_id) : null,
						dual_carriageway: way.dual_carriageway === "true",
						pdc_typology: way.pdc_typology
					},
					geojson: parsedGeojson,
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
		console.log(`✅ Inserted ${waysToInsert.length} ways from CSV\n`);

		console.log("✅ Cycling infra ways seed completed successfully!");

		return {
			ways: waysToInsert.length,
		};
	} catch (error) {
		console.error("❌ Error seeding cycling infra ways:", error);
		throw error;
	} finally {
		await closeDatabase(db);
	}
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
	seedCyclingInfraWays().catch((error) => {
		console.error("Seed failed:", error);
		process.exit(1);
	});
}