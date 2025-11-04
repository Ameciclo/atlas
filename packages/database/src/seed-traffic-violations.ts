import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { DatabaseConfig } from "./connection.js";
import { closeDatabase, createConnectedDatabase } from "./connection.js";
import * as trafficViolationsSchema from "./schemas/traffic-violations/index.js";

interface ViolationData {
	datainfracao: string;
	horainfracao: string;
	agente_id: number;
	infracao_id: number;
	local_id: number;
}

interface ViolationDict {
	[key: string]: number;
}

interface LocationDict {
	[key: string]: number;
}

interface AddressData {
	codigo_logradouro: string;
	latitude: number;
	longitude: number;
	endereco_infracao: string;
	local_id: number;
}

/**
 * Parse violation description into structured parts
 */
function parseViolationDescription(description: string) {
	const parts = description.split("|");
	return {
		violation_code: parts[0] || "",
		law_code: parts[1] || "",
		description: parts[2] || "",
	};
}

/**
 * Seed traffic violations data from TSV and JSON files
 */
export async function seedTrafficViolations(config: DatabaseConfig = {}) {
	const db = await createConnectedDatabase(config);

	try {
		console.log("🌱 Starting traffic violations seed...");

		// Load dictionaries and address data
		const basePath = join(
			import.meta.dirname,
			"../../../apps/traffic-violations/src/db",
		);
		const violationDictPath = join(basePath, "dict_infracoes_v2.json");
		const locationDictPath = join(basePath, "dict_locais_v2.json");
		const addressDataPath = join(basePath, "enderecos_otimizado.csv");
		const dataPath = join(basePath, "infracoes_reduzido.tsv");

		const violationDictRaw = await readFile(violationDictPath, "utf-8");
		const locationDictRaw = await readFile(locationDictPath, "utf-8");
		const addressDataRaw = await readFile(addressDataPath, "utf-8");
		const tsvData = await readFile(dataPath, "utf-8");

		const violationDict: ViolationDict = JSON.parse(violationDictRaw);
		const locationDict: LocationDict = JSON.parse(locationDictRaw);

		// Get existing street codes from official_streets table
		const existingStreets = await db
			.select({ code: trafficViolationsSchema.officialStreets.code })
			.from(trafficViolationsSchema.officialStreets);
		const existingStreetCodes = new Set(existingStreets.map((s) => s.code));

		// Parse CSV data
		const addressLines = addressDataRaw.trim().split("\n");
		const addressDataLines = addressLines.slice(1);

		// Create address lookup by local_id
		const addressLookup: { [key: number]: AddressData } = {};
		for (const line of addressDataLines) {
			const values = line.split(",");
			if (values.length >= 5) {
				const codigo_logradouro = values[0] || "";
				const latitude = Number(values[1]) || 0;
				const longitude = Number(values[2]) || 0;
				const local_id = Number(values[values.length - 1]) || 0;
				const endereco_infracao = values.slice(3, -1).join(",");

				addressLookup[local_id] = {
					codigo_logradouro,
					latitude,
					longitude,
					endereco_infracao,
					local_id,
				};
			}
		}

		// Reverse dictionaries for lookup
		const violationLookup = Object.fromEntries(
			Object.entries(violationDict).map(([desc, id]) => [id, desc]),
		);
		const locationLookup = Object.fromEntries(
			Object.entries(locationDict).map(([desc, id]) => [id, desc]),
		);

		// Parse TSV data
		const lines = tsvData.trim().split("\n");
		const _headers = lines[0]?.split("\t") || [];
		const dataLines = lines.slice(1);

		console.log(`📊 Found ${dataLines.length} violations to import`);

		let violationsCreated = 0;
		const batchSize = 1000;

		for (let i = 0; i < dataLines.length; i += batchSize) {
			const batch = dataLines.slice(i, i + batchSize);
			const violationsToInsert = [];

			for (const line of batch) {
				const values = line.split("\t");
				if (values.length < 5) continue;

				const violationData: ViolationData = {
					datainfracao: values[0] || "",
					horainfracao: values[1] || "",
					agente_id: Number(values[2]) || 0,
					infracao_id: Number(values[3]) || 0,
					local_id: Number(values[4]) || 0,
				};

				// Get descriptions from dictionaries
				const violationDescription =
					violationLookup[violationData.infracao_id] || "";
				const locationDescription =
					locationLookup[violationData.local_id] || "";

				if (!violationDescription || !locationDescription) continue;

				// Parse violation description
				const { violation_code, law_code, description } =
					parseViolationDescription(violationDescription);

				// Get address info from CSV data
				const addressInfo = addressLookup[violationData.local_id];
				const prefeituraAddress = locationDescription;

				// Get street code from address info (only if it exists in official_streets)
				let streetCode: number | null = null;
				if (addressInfo?.codigo_logradouro) {
					const code = Number(addressInfo.codigo_logradouro);
					// Only set if it's a valid number, not 0, and exists in official_streets
					if (
						!Number.isNaN(code) &&
						code > 0 &&
						existingStreetCodes.has(code)
					) {
						streetCode = code;
					}
				}

				// COORDINATES DISABLED: Field is already PostGIS geometry, not text
				// Need to use ST_GeomFromText() or raw SQL for PostGIS insertion
				const coordinates = null;

				// Build timestamp with validation
				const violationDateTime = new Date(
					`${violationData.datainfracao}T${violationData.horainfracao}`,
				);

				// Skip records with invalid dates
				if (Number.isNaN(violationDateTime.getTime())) {
					continue;
				}

				// Filter: only accept dates from 2009 to 2024 (exclude 2008 and future dates)
				const year = violationDateTime.getFullYear();
				if (year < 2009 || year > 2024) {
					continue;
				}

				violationsToInsert.push({
					violation_date: violationDateTime,
					agent_id: violationData.agente_id,
					violation_type_id: violationData.infracao_id,
					location_id: violationData.local_id,
					violation_code,
					law_code,
					description,
					location_description: prefeituraAddress,
					coordinates,
					street_code: streetCode,
					complementary_data: {
						original_violation_string: violationDescription,
						address_info: addressInfo || null,
					},
				});
			}

			if (violationsToInsert.length > 0) {
				// No coordinate validation needed - all coordinates are null

				try {
					await db
						.insert(trafficViolationsSchema.trafficViolations)
						.values(violationsToInsert);
				} catch (insertError) {
					console.error(
						`❌ Error inserting batch ${Math.floor(i / batchSize) + 1}:`,
						insertError,
					);
					// Log some sample data for debugging
					console.log(
						"Sample records from failed batch:",
						violationsToInsert.slice(0, 2).map((v) => ({
							coordinates: v.coordinates,
							location: v.location_description,
							date: v.violation_date,
						})),
					);
					throw insertError;
				}
				violationsCreated += violationsToInsert.length;
				console.log(
					`  ✓ Inserted batch ${Math.floor(i / batchSize) + 1}: ${violationsToInsert.length} violations`,
				);
			}
		}

		console.log("\n✅ Seed completed successfully!");
		console.log(`   🚨 Violations: ${violationsCreated} created`);
	} catch (error) {
		console.error("❌ Error seeding data:", error);
		throw error;
	} finally {
		await closeDatabase(db);
	}
}

/**
 * CLI entry point for running seed
 */
if (import.meta.url === `file://${process.argv[1]}`) {
	seedTrafficViolations().catch((error) => {
		console.error("Seed failed:", error);
		process.exit(1);
	});
}
