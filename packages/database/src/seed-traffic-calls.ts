import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import type { DatabaseConfig } from "./connection.js";
import { closeDatabase, createConnectedDatabase } from "./connection.js";
import * as trafficCallsSchema from "./schemas/traffic-calls/index.js";
import type { SeedDataManifest } from "./types/seed-manifest.js";
import { createSeedDataLoader } from "./utils/seed-data-loader.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// CSV files directory - can be overridden via environment variable
const CSV_DIR =
	process.env.CSV_DIR || join(__dirname, "../seed-data/traffic-calls");

// Load manifest for S3 configuration
let cachedManifest: SeedDataManifest | null = null;
async function loadManifest(): Promise<SeedDataManifest> {
	if (cachedManifest) return cachedManifest;
	const manifestPath = join(__dirname, "../seed-data/manifest.json");
	const manifestContent = readFileSync(manifestPath, "utf-8");
	cachedManifest = JSON.parse(manifestContent) as SeedDataManifest;
	return cachedManifest;
}

interface CSVRecord {
	[key: string]: string;
}

/**
 * Parse CSV content into records
 * Handles CSV files with comma-separated fields
 */
function parseCSV(content: string): CSVRecord[] {
	const lines = content.trim().split("\n");
	if (lines.length < 2) return [];

	const headerLine = lines[0];
	if (!headerLine) return [];

	// Parse header line
	const headers = headerLine.split(",").map((h) => h.trim());
	const records: CSVRecord[] = [];

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		if (!line) continue;

		const values = parseCSVLine(line);
		const record: CSVRecord = {};

		for (let j = 0; j < headers.length; j++) {
			const header = headers[j];
			const value = values[j] ?? "";

			if (header) {
				record[header] = value.trim();
			}
		}

		records.push(record);
	}

	return records;
}

/**
 * Parse a single CSV line handling quoted fields
 * Properly handles commas inside quoted fields
 */
function parseCSVLine(line: string): string[] {
	const result: string[] = [];
	let current = "";
	let insideQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];

		if (char === '"') {
			insideQuotes = !insideQuotes;
		} else if (char === "," && !insideQuotes) {
			result.push(current);
			current = "";
		} else {
			current += char;
		}
	}

	if (current) {
		result.push(current);
	}

	return result;
}

/**
 * Parse integer value from CSV field
 */
function parseIntOrZero(value: string | undefined): number {
	if (!value || value === "") return 0;
	const parsed = parseInt(value, 10);
	return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Parse boolean value from CSV field
 */
function parseBoolean(value: string | undefined): boolean {
	if (!value) return false;
	const lower = value.toLowerCase().trim();
	return lower === "true" || lower === "sim" || lower === "1";
}

/**
 * Normalize time format to HH:MM:SS (zero-padded)
 */
function normalizeTimeFormat(timeStr: string): string {
	// Handle cases like "6:05:00" -> "06:05:00"
	const parts = timeStr.split(":");
	if (parts.length !== 3) {
		return timeStr; // Return as-is if format is unexpected
	}

	const hour = parts[0].padStart(2, "0");
	const minute = parts[1].padStart(2, "0");
	const second = parts[2].padStart(2, "0");

	return `${hour}:${minute}:${second}`;
}

/**
 * Convert CSV record to database record
 */
function convertRecord(record: CSVRecord) {
	// Combine date and time into a Date object
	let dateStr = record.data || "";
	let timeStr = record.hora || "00:00:00";

	// Handle case where dateStr already contains time (e.g., "2023-01-01T00:00:00")
	// Extract just the date part if it contains a T
	if (dateStr.includes("T")) {
		dateStr = dateStr.split("T")[0];
	}

	// Handle case where timeStr contains date (shouldn't happen, but be safe)
	if (timeStr.includes("T")) {
		timeStr = timeStr.split("T")[1] || "00:00:00";
	}

	// Normalize time format to ensure zero-padded hours/minutes/seconds
	timeStr = normalizeTimeFormat(timeStr);

	const datetime = new Date(`${dateStr}T${timeStr}`);

	// Validate datetime
	if (Number.isNaN(datetime.getTime())) {
		throw new Error(`Invalid datetime: ${dateStr} ${timeStr}`);
	}

	// Parse vehicles
	const vehicles = {
		cars: parseIntOrZero(record.auto),
		motorcycles: parseIntOrZero(record.moto),
		bicycles: parseIntOrZero(record.ciclom),
		cyclists: parseIntOrZero(record.ciclista),
		pedestrians: parseIntOrZero(record.pedestre),
		buses: parseIntOrZero(record.onibus),
		trucks: parseIntOrZero(record.caminhao),
		police_vehicles: parseIntOrZero(record.viatura),
		others: parseIntOrZero(record.outros),
	};

	// Parse crash data
	const crash_data = {
		type: record.tipo || "",
		description: record.descricao || "",
		vehicles,
	};

	// Parse environmental data
	const environmental_data = {
		weather: record.tempo_clima || undefined,
		traffic_light_number: record.num_semaforo || undefined,
		traffic_light_status: record.situacao_semaforo || undefined,
		signage: record.sinalizacao || undefined,
		road_conditions: record.condicao_via || undefined,
		road_conservation: record.conservacao_via || undefined,
		road_direction: record.sentido_via || undefined,
		sign_status: record.situacao_placa || undefined,
		max_speed: record.velocidade_max_via || undefined,
		traffic_direction: record.mao_direcao || undefined,
		road_divisions: [
			record.divisao_via1,
			record.divisao_via2,
			record.divisao_via3,
		].filter((v) => v && v !== ""),
	};

	// Parse metadata
	const metadata = {
		original_id: record._id || undefined,
		protocol: record.Protocolo || undefined,
		status: record.situacao || undefined,
		verified: parseBoolean(record.acidente_verificado),
		control_point: record.ponto_controle || undefined,
		location_details: {
			street_number: record.numero || undefined,
			address_detail: record.detalhe_endereco_acidente || undefined,
			complement: record.complemento || undefined,
			cross_street: record.endereco_cruzamento || undefined,
			cross_street_number: record.numero_cruzamento || undefined,
			cross_street_reference: record.referencia_cruzamento || undefined,
			cross_street_neighborhood: record.bairro_cruzamento || undefined,
		},
	};

	// Parse victims
	const total_victims = parseIntOrZero(record.vitimas);
	const fatal_victims = parseIntOrZero(record.vitimasfatais);
	const injured_victims = total_victims - fatal_victims;

	return {
		datetime,
		nature: record.natureza_acidente || "",
		street_name: record.endereco || "",
		neighborhood: record.bairro || "",
		coordinates: null, // Future: geocoding
		total_victims,
		injured_victims,
		fatal_victims,
		crash_data,
		environmental_data,
		metadata,
	};
}

/**
 * Seed traffic calls data from CSV file (Git or S3)
 * Idempotent: Checks for existing data before inserting
 */
export async function seedTrafficCalls(config: DatabaseConfig = {}) {
	const db = await createConnectedDatabase(config);
	const useS3 = process.env.SEED_DATA_USE_S3 === "true";

	try {
		console.log("🚦 Starting traffic calls data seeding...");
		console.log(
			`📍 Data source: ${useS3 ? "S3 (DigitalOcean Spaces)" : "Local files"}\n`,
		);

		let totalInserted = 0;
		let totalSkipped = 0;
		let totalErrors = 0;
		const errorReasons: Record<string, number> = {};

		// Check if data already exists
		const existingCount = await db
			.select({ count: sql<number>`count(*)` })
			.from(trafficCallsSchema.trafficCalls);

		if (existingCount[0] && existingCount[0].count > 0) {
			console.log(
				`  ↪ Data already imported (${existingCount[0].count} records exist)`,
			);
			return {
				totalInserted: 0,
				totalSkipped: existingCount[0].count,
				totalErrors: 0,
			};
		}

		let csvContent: string;

		// Load CSV file
		if (useS3) {
			// Load from S3 using manifest
			const manifestData = await loadManifest();

			if (!manifestData?.datasets?.["traffic-calls"]?.s3?.files) {
				throw new Error("Manifest data not loaded or invalid");
			}

			const fileInfo = manifestData.datasets["traffic-calls"].s3.files.find(
				(f) => f.name === "sinistros-cttu-2016-2024-vias-corrigidas.csv",
			);

			if (!fileInfo) {
				throw new Error("File not found in manifest");
			}

			console.log(`📂 Loading from S3: ${fileInfo.key}`);
			const loader = createSeedDataLoader({ useS3 });
			csvContent = await loader.loadCSV(
				{
					type: "s3",
					path: fileInfo.key,
					bucket: manifestData.datasets["traffic-calls"].s3.bucket,
				},
				fileInfo.checksum,
			);
		} else {
			// Load from local file
			const csvPath = join(
				CSV_DIR,
				"sinistros-cttu-2016-2024-vias-corrigidas.csv",
			);
			console.log(`📂 Reading CSV file: ${csvPath}`);
			csvContent = readFileSync(csvPath, "utf-8");
		}

		console.log("📊 Parsing CSV data...");
		const records = parseCSV(csvContent);
		console.log(`   Found ${records.length} records`);

		console.log("💾 Inserting records into database (batch size: 100)...");
		const BATCH_SIZE = 100;

		// Process records in batches
		for (
			let batchStart = 0;
			batchStart < records.length;
			batchStart += BATCH_SIZE
		) {
			const batchEnd = Math.min(batchStart + BATCH_SIZE, records.length);
			const batch = records.slice(batchStart, batchEnd);

			if (batchStart % 1000 === 0) {
				console.log(
					`   Progress: ${batchStart}/${records.length} records processed...`,
				);
			}

			try {
				// Convert all records in batch
				const convertedBatch = batch
					.map((record) => {
						try {
							return convertRecord(record);
						} catch (error) {
							const errorMsg =
								error instanceof Error ? error.message : String(error);
							errorReasons[errorMsg] = (errorReasons[errorMsg] || 0) + 1;
							totalSkipped++;
							return null;
						}
					})
					.filter((r) => r !== null);

				// Insert batch
				if (convertedBatch.length > 0) {
					await db
						.insert(trafficCallsSchema.trafficCalls)
						.values(convertedBatch);
					totalInserted += convertedBatch.length;
				}
			} catch (error) {
				console.error(`   ⚠️  Batch insert error:`, error);
				totalErrors += batch.length;
			}
		}

		console.log(`\n✅ Seeding complete!`);
		console.log(`   Inserted: ${totalInserted}`);
		console.log(`   Skipped: ${totalSkipped}`);
		console.log(`   Errors: ${totalErrors}`);

		if (totalSkipped > 0) {
			console.log(`\n📋 Skipped records breakdown:`);
			Object.entries(errorReasons)
				.sort((a, b) => b[1] - a[1])
				.forEach(([reason, count]) => {
					console.log(`   - ${reason}: ${count}`);
				});
		}
		console.log();

		return {
			totalInserted,
			totalSkipped,
			totalErrors,
		};
	} catch (error) {
		console.error("❌ Error seeding traffic calls:", error);
		throw error;
	} finally {
		await closeDatabase(db);
	}
}
