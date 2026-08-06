import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "drizzle-orm";
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

		if (char === "\n" && !inQuotes) {
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

	const headers =
		lines[0]?.split(",").map((h) => h.replace(/"/g, "").trim()) || [];

	return lines
		.slice(1)
		.filter((line) => line.trim())
		.map((line) => {
			const values: string[] = [];
			let currentValue = "";
			let inQuotes = false;

			// Parse values properly handling quoted fields
			for (let i = 0; i < line.length; i++) {
				const char = line[i];

				if (char === '"') {
					inQuotes = !inQuotes;
				} else if (char === "," && !inQuotes) {
					values.push(currentValue.replace(/"/g, "").trim());
					currentValue = "";
				} else {
					currentValue += char;
				}
			}

			// Add last value
			values.push(currentValue.replace(/"/g, "").trim());

			const row: Record<string, string> = {};
			headers.forEach((header, i) => {
				row[header] = values[i] || "";
			});
			return row;
		});
}

export async function seedCyclingInfraStatic(config: DatabaseConfig = {}) {
	const db = await createConnectedDatabase(config);

	try {
		console.log("🌱 Starting cycling infrastructure static seed...\n");

		const dataPath = join(__dirname, "../seed-data/cycling-infra");

		// 1. Seed Cities
		console.log("📊 Loading cities...");
		const citiesContent = await readFile(join(dataPath, "cities.csv"), "utf-8");
		const citiesData = parseCSV(citiesContent) as unknown as CSVCity[];

		console.log(`Found ${citiesData.length} cities`);

		const citiesToInsert = citiesData.map((city) => ({
			id: parseInt(city.id, 10),
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
			.onConflictDoUpdate({
				target: [cyclingInfraSchema.cyclistInfraRelations.pdc_ref],
				set: {
					pdc_typology: sql`EXCLUDED.pdc_typology`,
					name: sql`EXCLUDED.name`,
					osm_id: sql`EXCLUDED.osm_id`,
					pdc_stretch: sql`EXCLUDED.pdc_stretch`,
					pdc_cities: sql`EXCLUDED.pdc_cities`,
					pdc_notes: sql`EXCLUDED.pdc_notes`,
					notes: sql`EXCLUDED.notes`,
					pdc_km: sql`EXCLUDED.pdc_km`,
				},
			});
		console.log(`✅ Inserted ${relationsToInsert.length} relations\n`);

		// 3. Seed Relation-Cities relationships
		console.log("🔗 Loading relation-cities...");
		const relationCitiesContent = await readFile(
			join(dataPath, "relations_cities.csv"),
			"utf-8",
		);
		const relationCitiesData = parseCSV(relationCitiesContent);

		console.log(`Found ${relationCitiesData.length} relation-city rows`);
		console.log("First few rows:", relationCitiesData.slice(0, 3));

		const relationCitiesToInsert = relationCitiesData
			.map((row) => {
				const cleanRow: Record<string, string> = {};
				for (const [key, value] of Object.entries(row)) {
					const cleanKey = key.replace(/\r/g, "");
					const cleanValue = value.replace(/\r/g, "");
					cleanRow[cleanKey] = cleanValue;
				}
				return cleanRow;
			})
			.filter(
				(row) =>
					row.relation_id &&
					row.city_id &&
					row.relation_id.trim() !== "" &&
					row.city_id.trim() !== "",
			)
			.map((row) => ({
				relation_id: parseInt(row.relation_id!, 10),
				city_id: parseInt(row.city_id!, 10),
			}))
			.filter(
				(row) => !Number.isNaN(row.relation_id) && !Number.isNaN(row.city_id),
			);

		if (relationCitiesToInsert.length === 0) {
			console.log("⚠️ No valid relation-city relationships to insert");
			return;
		}

		await db
			.insert(cyclingInfraSchema.cyclistInfraRelationCities)
			.values(relationCitiesToInsert)
			.onConflictDoNothing({
				target: [
					cyclingInfraSchema.cyclistInfraRelationCities.relation_id,
					cyclingInfraSchema.cyclistInfraRelationCities.city_id,
				],
			});

		console.log(
			`✅ Inserted ${relationCitiesToInsert.length} relation-city relationships\n`,
		);

		// 4. Seed City Boundaries (IBGE Municipal Limits)
		console.log("🗺️ Loading city boundaries...");
		const boundariesContent = await readFile(
			join(dataPath, "pe_limites_municipais.geojson"),
			"utf-8",
		);
		const boundariesData = JSON.parse(boundariesContent) as GeoJSONCollection;

		console.log(`Found ${boundariesData.features.length} municipal boundaries`);

		let insertedBoundaries = 0;
		for (const feature of boundariesData.features) {
			const cityId = parseInt(feature.properties.CD_MUN, 10);
			const name = feature.properties.NM_MUN;

			if (Number.isNaN(cityId) || !name) {
				console.log(`  ⚠️ Skipping feature with invalid CD_MUN or NM_MUN`);
				continue;
			}

			const geomJson = JSON.stringify(feature.geometry);

			await db.execute(
				sql`
					INSERT INTO city_boundaries (city_id, name, boundary)
					VALUES (${cityId}, ${name}, ST_GeomFromGeoJSON(${geomJson}))
					ON CONFLICT (city_id) DO NOTHING
				`,
			);
			insertedBoundaries++;
		}
		console.log(`✅ Inserted ${insertedBoundaries} municipal boundaries\n`);

		console.log(
			"✅ Cycling infrastructure static seed completed successfully!",
		);

		return {
			cities: citiesToInsert.length,
			relations: relationsToInsert.length,
			relationCities: relationCitiesToInsert.length,
			boundaries: insertedBoundaries,
		};
	} catch (error) {
		console.error("❌ Error seeding cycling infrastructure static:", error);
		throw error;
	} finally {
		await closeDatabase(db);
	}
}

export async function seedCyclingInfra(config: DatabaseConfig = {}) {
	const db = await createConnectedDatabase(config);

	try {
		console.log("🌱 Starting cycling infrastructure ways seed...\n");

		const dataPath = join(__dirname, "../seed-data/cycling-infra");

		// Carrega os dados em memória antes da transaction
		console.log("🛣️ Loading processed ways...");
		const waysContent = await readFile(
			join(dataPath, "pdc_ways.json"),
			"utf-8",
		);
		const waysData = JSON.parse(waysContent);

		console.log("🚴 Loading non-PDC ways...");
		const nonPdcContent = await readFile(
			join(dataPath, "non_pdc_ways.json"),
			"utf-8",
		);
		const nonPdcData = JSON.parse(nonPdcContent);

		const allRelations = await db
			.select()
			.from(cyclingInfraSchema.cyclistInfraRelations);
		console.log(`Found ${allRelations.length} relations in DB`);
		console.log(
			"Sample relations:",
			allRelations.slice(0, 3).map((r) => ({ id: r.id, osm_id: r.osm_id })),
		);

		const relationMap = new Map(allRelations.map((r) => [r.osm_id, r.id]));
		console.log(
			"RelationMap keys:",
			Array.from(relationMap.keys()).slice(0, 5),
		);
		console.log(
			"Sample way relation_ids:",
			waysData.slice(0, 5).map((w: any) => w.relation_id),
		);

		const waysToInsert = waysData
			.map((way: any) => {
				const geojsonData = JSON.parse(way.geojson);
				const geometry = geojsonData.features[0].geometry;

				let relationId = null;
				if (
					way.relation_id &&
					way.relation_id !== 0 &&
					way.relation_id !== "0"
				) {
					relationId = relationMap.get(way.relation_id) || null;

					if (waysData.indexOf(way) < 3) {
						console.log(
							`Way ${way.osm_id}: relation_id=${way.relation_id} found=${relationId}`,
						);
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
						lastupdated: way.lastupdated,
					},
					geojson: geojsonData,
				};
			})
			.filter((way: any) => way.coordinates !== null);

		const nonPdcToInsert = nonPdcData.map((way: any) => {
			const geojsonData = JSON.parse(way.geojson);
			const geometry = geojsonData.features[0].geometry;

			return {
				osm_id: `way/${way.osm_id}`,
				relation_id: null,
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
					lastupdated: way.lastupdated,
				},
				geojson: geojsonData,
			};
		});

		console.log(
			`\n📦 Ready to seed: ${waysToInsert.length} PDC ways + ${nonPdcToInsert.length} non-PDC ways`,
		);

		// Safety net: remove non-PDC ways that duplicate PDC ways with has_cycleway=true.
		// The Python ETL scripts should prevent this, but double-check at seed time.
		const pdcOsmIds = new Set(
			waysData
				.filter(
					(w: any) =>
						w.has_cycleway === "True" ||
						w.has_cycleway === true ||
						w.has_cycleway === "true",
				)
				.map((w: any) => `way/${w.osm_id}`),
		);
		const dedupedNonPdc = nonPdcToInsert.filter(
			(w: any) => !pdcOsmIds.has(w.osm_id),
		);
		if (dedupedNonPdc.length < nonPdcToInsert.length) {
			console.log(
				`\n⚠️  Removed ${nonPdcToInsert.length - dedupedNonPdc.length} non-PDC ways that overlap with PDC ways`,
			);
		}

		// Transaction atômica: truncate + insert. Se algo falhar, rollback restaura dados antigos.
		await db.transaction(async (tx) => {
			console.log("\n🗑️ Truncating pdc_relation_ways...");
			await tx.execute(sql`TRUNCATE TABLE pdc_relation_ways RESTART IDENTITY`);
			console.log("✅ Truncated\n");

			console.log(`🛣️ Inserting ${waysToInsert.length} PDC ways...`);
			const batchSize = 1000;
			for (let i = 0; i < waysToInsert.length; i += batchSize) {
				const batch = waysToInsert.slice(i, i + batchSize);
				await tx.insert(cyclingInfraSchema.pdcRelationWays).values(batch);
				console.log(
					`  ✓ PDC batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(waysToInsert.length / batchSize)}`,
				);
			}
			console.log(`✅ Inserted ${waysToInsert.length} PDC ways`);

			console.log(`\n🚴 Inserting ${dedupedNonPdc.length} non-PDC ways...`);
			for (let i = 0; i < dedupedNonPdc.length; i += batchSize) {
				const batch = dedupedNonPdc.slice(i, i + batchSize);
				await tx.insert(cyclingInfraSchema.pdcRelationWays).values(batch);
				console.log(
					`  ✓ Non-PDC batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(dedupedNonPdc.length / batchSize)}`,
				);
			}
			console.log(`✅ Inserted ${dedupedNonPdc.length} non-PDC ways`);
		});

		console.log(
			"\n✅ Cycling infrastructure ways seed completed successfully!",
		);

		return {
			ways: waysToInsert.length,
			nonPdcWays: dedupedNonPdc.length,
		};
	} catch (error) {
		console.error("❌ Error seeding cycling infrastructure ways:", error);
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
