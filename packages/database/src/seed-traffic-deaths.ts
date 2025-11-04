import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import type { DatabaseConfig } from "./connection.js";
import { closeDatabase, createConnectedDatabase } from "./connection.js";
import * as trafficDeathsSchema from "./schemas/traffic-deaths/index.js";
import { createSeedDataLoader } from "./utils/seed-data-loader.js";
import type { SeedDataManifest } from "./types/seed-manifest.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// CSV files directory - can be overridden via environment variable
const CSV_DIR =
	process.env.CSV_DIR || join(__dirname, "../seed-data/traffic-deaths");

// Load manifest for S3 configuration
let manifest: SeedDataManifest | null = null;
async function loadManifest(): Promise<SeedDataManifest> {
	if (manifest) return manifest;
	const manifestPath = join(__dirname, "../seed-data/manifest.json");
	const manifestContent = readFileSync(manifestPath, "utf-8");
	manifest = JSON.parse(manifestContent);
	return manifest;
}

interface TrafficDeathRecord {
	[key: string]: string | number | null;
}

/**
 * Parse CSV content into records
 */
function parseCSV(content: string): TrafficDeathRecord[] {
	const lines = content.trim().split("\n");
	if (lines.length < 2) return [];

	const headerLine = lines[0];
	if (!headerLine) return [];

	const headers = headerLine.split(",").map((h) => h.trim());
	const records: TrafficDeathRecord[] = [];

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		if (!line) continue;

		const values = line.split(",").map((v) => v.trim());
		const record: TrafficDeathRecord = {};

		for (let j = 0; j < headers.length; j++) {
			const header = headers[j];
			const value = values[j] ?? "";
			if (header) {
				record[header] = value === "" ? null : value;
			}
		}

		records.push(record);
	}

	return records;
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
				if (useS3 && manifestData) {
					// Load from S3 using manifest
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
				const existingRecords = await db
					.select()
					.from(trafficDeathsSchema.trafficDeaths)
					.where(eq(trafficDeathsSchema.trafficDeaths.data_year, year))
					.limit(1);

				if (existingRecords.length > 0) {
					console.log(
						`  ↪ Year ${year} already imported (${records.length} records skipped)`,
					);
					totalSkipped += records.length;
					continue;
				}

				console.log(`💾 Inserting records into database...`);
				let inserted = 0;
				let errors = 0;

				for (const record of records) {
					try {
						const recordData: Record<string, unknown> = {
							...record,
							data_year: year,
							import_batch: batchId,
						};

						await db
							.insert(trafficDeathsSchema.trafficDeaths)
							.values(
								recordData as typeof trafficDeathsSchema.trafficDeaths.$inferInsert,
							)
							.onConflictDoNothing();

						inserted++;
					} catch (error) {
						errors++;
						if (errors <= 5) {
							console.error(`   Error inserting record:`, error);
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
