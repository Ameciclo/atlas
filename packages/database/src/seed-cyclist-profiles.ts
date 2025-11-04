import "dotenv/config";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import type { DatabaseConfig } from "./connection.js";
import { closeDatabase, createConnectedDatabase } from "./connection.js";
import * as cyclistProfileSchema from "./schemas/cyclist-profile/index.js";
import { createSeedDataLoader } from "./utils/seed-data-loader.js";
import type { SeedDataManifest } from "./types/seed-manifest.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Load manifest for S3 configuration
let manifest: SeedDataManifest | null = null;
async function loadManifest(): Promise<SeedDataManifest> {
	if (manifest) return manifest;
	const manifestPath = join(__dirname, "../seed-data/manifest.json");
	const manifestContent = readFileSync(manifestPath, "utf-8");
	manifest = JSON.parse(manifestContent);
	return manifest;
}

interface CyclistProfileData {
	id?: number;
	data: Record<string, unknown>;
	metadata: Record<string, unknown>;
	created_at?: string;
	updated_at?: string;
}

/**
 * Seed cyclist profiles data from JSON file (Git or S3)
 * Idempotent: Uses top-level id field mapped to metadata.id to prevent duplicates
 */
export async function seedCyclistProfiles(config: DatabaseConfig = {}) {
	const db = await createConnectedDatabase(config);
	const useS3 = process.env.SEED_DATA_USE_S3 === "true";

	try {
		console.log("🚴 Starting cyclist profiles seed...");
		console.log(
			`📍 Data source: ${useS3 ? "S3 (DigitalOcean Spaces)" : "Local files"}\n`,
		);

		// Load the JSON data
		let profilesData: CyclistProfileData[];

		if (useS3) {
			// Load from S3 using manifest
			const manifestData = await loadManifest();
			const loader = createSeedDataLoader({ useS3 });
			const fileInfo = manifestData.datasets["cyclist-profiles"].s3.files[0];

			if (!fileInfo) {
				throw new Error("Cyclist profiles file not found in manifest");
			}

			console.log(`📂 Loading from S3: ${fileInfo.key}`);
			profilesData = await loader.loadJSON(
				{
					type: "s3",
					path: fileInfo.key,
					bucket: manifestData.datasets["cyclist-profiles"].s3.bucket,
				},
				fileInfo.checksum,
			);
		} else {
			// Load from local file
			const dataPath = join(
				import.meta.dirname,
				"../seed-data/cyclist-profiles/data.json",
			);
			const rawData = await readFile(dataPath, "utf-8");
			profilesData = JSON.parse(rawData);
		}

		console.log(`📊 Found ${profilesData.length} cyclist profiles to import`);

		let profilesCreated = 0;
		let profilesSkipped = 0;

		for (const profileData of profilesData) {
			// Extract profile ID for idempotency check (use top-level id field)
			const profileId = profileData.id;

			if (!profileId) {
				console.warn(
					`⚠️  Skipping profile without id: ${JSON.stringify(profileData).substring(0, 50)}...`,
				);
				profilesSkipped++;
				continue;
			}

			// Check if profile already exists using JSONB contains operator
			// The @> operator checks if metadata contains {"id": profileId}
			const existingProfile = await db
				.select()
				.from(cyclistProfileSchema.cyclistProfiles)
				.where(
					sql`${cyclistProfileSchema.cyclistProfiles.metadata} @> ${JSON.stringify({ id: profileId })}`,
				)
				.limit(1);

			if (existingProfile.length > 0) {
				console.log(`  ↪ Using existing profile (ID: ${profileId})`);
				profilesSkipped++;
				continue;
			}

			// Remove timestamps if they exist (database will set them)
			const { created_at, updated_at, id, ...dataToInsert } = profileData;

			// Insert new profile with id stored in metadata for idempotency
			const [newProfile] = await db
				.insert(cyclistProfileSchema.cyclistProfiles)
				.values({
					data: dataToInsert.data,
					metadata: { ...dataToInsert.metadata, id: profileId },
				})
				.returning();

			if (!newProfile) {
				throw new Error(`Failed to create profile with ID: ${profileId}`);
			}

			profilesCreated++;
			console.log(`  ✓ Created profile (ID: ${profileId})`);
		}

		console.log("\n✅ Cyclist profiles seed completed successfully!");
		console.log(
			`   📍 Profiles: ${profilesCreated} created, ${profilesSkipped} skipped`,
		);

		return { profilesCreated, profilesSkipped };
	} catch (error) {
		console.error("❌ Error seeding cyclist profiles:", error);
		throw error;
	} finally {
		await closeDatabase(db);
	}
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	seedCyclistProfiles()
		.then(() => {
			process.exit(0);
		})
		.catch((error) => {
			console.error(error);
			process.exit(1);
		});
}
