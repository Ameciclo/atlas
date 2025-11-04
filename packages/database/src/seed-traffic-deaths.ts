import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import type { DatabaseConfig } from "./connection.js";
import { closeDatabase, createConnectedDatabase } from "./connection.js";
import * as trafficDeathsSchema from "./schemas/traffic-deaths/index.js";
import type { SeedDataManifest } from "./types/seed-manifest.js";
import { createSeedDataLoader } from "./utils/seed-data-loader.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// CSV files directory - can be overridden via environment variable
const CSV_DIR =
	process.env.CSV_DIR || join(__dirname, "../seed-data/traffic-deaths");

// Load manifest for S3 configuration
let cachedManifest: SeedDataManifest | null = null;
async function loadManifest(): Promise<SeedDataManifest> {
	if (cachedManifest) return cachedManifest;
	const manifestPath = join(__dirname, "../seed-data/manifest.json");
	const manifestContent = readFileSync(manifestPath, "utf-8");
	cachedManifest = JSON.parse(manifestContent) as SeedDataManifest;
	return cachedManifest;
}

interface TrafficDeathRecord {
	[key: string]: string | number | null;
}

/**
 * Parse quoted CSV content into records
 * Handles CSV files with quoted fields like: "FIELD1","FIELD2","VALUE"
 */
function parseCSV(content: string): TrafficDeathRecord[] {
	const lines = content.trim().split("\n");
	if (lines.length < 2) return [];

	const headerLine = lines[0];
	if (!headerLine) return [];

	// Parse header line - remove quotes from field names
	const headers = parseCSVLine(headerLine).map((h) =>
		h.toLowerCase().replace(/^"|"$/g, ""),
	);
	const records: TrafficDeathRecord[] = [];

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		if (!line) continue;

		const values = parseCSVLine(line);
		const record: TrafficDeathRecord = {};

		for (let j = 0; j < headers.length; j++) {
			const header = headers[j];
			let value = values[j] ?? "";

			// Remove surrounding quotes if present
			if (value.startsWith('"') && value.endsWith('"')) {
				value = value.slice(1, -1);
			}

			if (header) {
				// Convert "NA" strings to null
				record[header] = value === "" || value === "NA" ? null : value;
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
			current += char;
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
 * Convert DATASUS date format (DDMMYYYY) to ISO date format (YYYY-MM-DD)
 */
function parseDATASUSDate(dateStr: string | null): string | null {
	if (!dateStr || dateStr === "NA") return null;

	// Remove any whitespace
	dateStr = dateStr.trim();

	// Check if it's in DDMMYYYY format (8 digits)
	if (!/^\d{8}$/.test(dateStr)) {
		return null;
	}

	const day = dateStr.substring(0, 2);
	const month = dateStr.substring(2, 4);
	const year = dateStr.substring(4, 8);

	// Validate date components
	const dayNum = parseInt(day, 10);
	const monthNum = parseInt(month, 10);

	if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12) {
		return null;
	}

	// Return in ISO format YYYY-MM-DD
	return `${year}-${month}-${day}`;
}

/**
 * Seed traffic deaths data from CSV files (Git or S3)
 * Idempotent: Uses import_batch to track already-imported data
 */
export async function seedTrafficDeaths(config: DatabaseConfig = {}) {
	const db = await createConnectedDatabase(config);
	const batchId = `seed-${new Date().toISOString()}`;
	const years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023];
	const useS3 = process.env.SEED_DATA_USE_S3 === "true";

	try {
		console.log("🚗 Starting traffic deaths data seeding...");
		console.log(`📦 Batch ID: ${batchId}`);
		console.log(
			`📍 Data source: ${useS3 ? "S3 (DigitalOcean Spaces)" : "Local files"}\n`,
		);

		let totalInserted = 0;
		let totalSkipped = 0;
		let totalErrors = 0;

		// Load manifest if using S3
		let manifestData: SeedDataManifest | null = null;
		if (useS3) {
			manifestData = await loadManifest();
		}

		const loader = createSeedDataLoader({ useS3 });

		for (const year of years) {
			let csvContent: string;

			try {
				if (useS3) {
					// Load from S3 using manifest
					if (!manifestData?.datasets?.["traffic-deaths"]?.s3?.files) {
						throw new Error("Manifest data not loaded or invalid");
					}

					const fileInfo = manifestData.datasets[
						"traffic-deaths"
					].s3.files.find((f) => f.name === `mortes_transito_${year}.csv`);

					if (!fileInfo) {
						console.log(`⚠️  File not found in manifest for year ${year}`);
						continue;
					}

					console.log(`📂 Loading from S3: ${fileInfo.key}`);
					csvContent = await loader.loadCSV(
						{
							type: "s3",
							path: fileInfo.key,
							bucket: manifestData.datasets["traffic-deaths"].s3.bucket,
						},
						fileInfo.checksum,
					);
				} else {
					// Load from local file
					const csvPath = join(CSV_DIR, `mortes_transito_${year}.csv`);
					console.log(`📂 Reading CSV file: ${csvPath}`);
					csvContent = readFileSync(csvPath, "utf-8");
				}

				console.log(`📊 Parsing CSV data for year ${year}...`);
				const records = parseCSV(csvContent);
				console.log(`   Found ${records.length} records`);

				// Check if this year's data is already imported
				const existingCount = await db
					.select({ count: trafficDeathsSchema.trafficDeaths.id })
					.from(trafficDeathsSchema.trafficDeaths)
					.where(eq(trafficDeathsSchema.trafficDeaths.data_year, year));

				if (existingCount.length > 0) {
					console.log(
						`  ↪ Year ${year} already imported (${records.length} records skipped)`,
					);
					totalSkipped += records.length;
					continue;
				}

				console.log(`💾 Inserting records into database (batch size: 100)...`);
				let inserted = 0;
				let errors = 0;
				const totalRecords = records.length;
				const BATCH_SIZE = 100;

				// Process records in batches
				for (
					let batchStart = 0;
					batchStart < records.length;
					batchStart += BATCH_SIZE
				) {
					const batchEnd = Math.min(batchStart + BATCH_SIZE, records.length);
					const batch = records.slice(batchStart, batchEnd);

					if (batchStart % 5000 === 0) {
						console.log(
							`   Progress: ${batchStart}/${totalRecords} records processed...`,
						);
					}

					try {
						// Convert all records in batch
						const convertedBatch = batch
							.map((record) => {
								// Skip records with missing required fields
								if (!record.dtobito || !record.causabas) {
									return null;
								}

								return {
									// Preserve all original fields
									...record,
									// Override with converted values
									data_year: year,
									import_batch: batchId,
									// Convert date fields (override original string values)
									dtobito: parseDATASUSDate(record.dtobito as string) || "",
									dtnasc: parseDATASUSDate(record.dtnasc as string),
									dtinvestig: parseDATASUSDate(record.dtinvestig as string),
									dtcadastro: parseDATASUSDate(record.dtcadastro as string),
									dtrecebim: parseDATASUSDate(record.dtrecebim as string),
									dtatestado: parseDATASUSDate(record.dtatestado as string),
									dtrecoriga: parseDATASUSDate(record.dtrecoriga as string),
									dtcadinv: parseDATASUSDate(record.dtcadinv as string),
									dtconinv: parseDATASUSDate(record.dtconinv as string),
									dtconcaso: parseDATASUSDate(record.dtconcaso as string),
									// Convert numeric fields
									contador: record.contador
										? parseInt(record.contador as string, 10)
										: null,
									codmunnatu: record.codmunnatu
										? parseInt(record.codmunnatu as string, 10)
										: null,
									idade: record.idade
										? parseInt(record.idade as string, 10)
										: null,
									codmunres: record.codmunres
										? parseInt(record.codmunres as string, 10)
										: null,
									codmunocor: record.codmunocor
										? parseInt(record.codmunocor as string, 10)
										: null,
									idademae: record.idademae
										? parseInt(record.idademae as string, 10)
										: null,
									qtdfilvivo: record.qtdfilvivo
										? parseInt(record.qtdfilvivo as string, 10)
										: null,
									qtdfilmort: record.qtdfilmort
										? parseInt(record.qtdfilmort as string, 10)
										: null,
									semagestac: record.semagestac
										? parseInt(record.semagestac as string, 10)
										: null,
									peso: record.peso
										? parseInt(record.peso as string, 10)
										: null,
									nudiasobco: record.nudiasobco
										? parseInt(record.nudiasobco as string, 10)
										: null,
									nudiasobin: record.nudiasobin
										? parseInt(record.nudiasobin as string, 10)
										: null,
									nudiasinf: record.nudiasinf
										? parseInt(record.nudiasinf as string, 10)
										: null,
								} as unknown as typeof trafficDeathsSchema.trafficDeaths.$inferInsert;
							})
							.filter(
								(record) => record !== null,
							) as (typeof trafficDeathsSchema.trafficDeaths.$inferInsert)[];

						if (convertedBatch.length === 0) {
							continue;
						}

						// Insert entire batch at once
						await db
							.insert(trafficDeathsSchema.trafficDeaths)
							.values(convertedBatch)
							.onConflictDoNothing();

						inserted += convertedBatch.length;
					} catch (error) {
						errors += batch.length;
						if (errors <= 5) {
							console.error(`   Error inserting batch:`, error);
						}
					}
				}

				totalInserted += inserted;
				totalErrors += errors;

				console.log(
					`✅ Year ${year} completed: ${inserted} inserted, ${errors} errors\n`,
				);
			} catch (error) {
				console.error(`❌ Error processing year ${year}:`, error);
				totalErrors += 1;
			}
		}

		console.log("=".repeat(60));
		console.log("🎉 Traffic deaths seeding completed!");
		console.log(`   Total records inserted: ${totalInserted}`);
		console.log(`   Total records skipped: ${totalSkipped}`);
		console.log(`   Total errors: ${totalErrors}`);
		console.log("=".repeat(60));

		return { totalInserted, totalSkipped, totalErrors };
	} catch (error) {
		console.error("❌ Error seeding traffic deaths:", error);
		throw error;
	} finally {
		await closeDatabase(db);
	}
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	seedTrafficDeaths()
		.then(() => {
			process.exit(0);
		})
		.catch((error) => {
			console.error(error);
			process.exit(1);
		});
}
