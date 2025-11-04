import "dotenv/config";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq } from "drizzle-orm";
import type { DatabaseConfig } from "./connection.js";
import { closeDatabase, createConnectedDatabase } from "./connection.js";
import * as cyclistCountsSchema from "./schemas/cyclist-counts/index.js";
import type { SeedDataManifest } from "./types/seed-manifest.js";
import { createSeedDataLoader } from "./utils/seed-data-loader.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Load manifest for S3 configuration
let cachedManifest: SeedDataManifest | null = null;
async function loadManifest(): Promise<SeedDataManifest> {
	if (cachedManifest) return cachedManifest;
	const manifestPath = join(__dirname, "../seed-data/manifest.json");
	const manifestContent = readFileSync(manifestPath, "utf-8");
	cachedManifest = JSON.parse(manifestContent) as SeedDataManifest;
	return cachedManifest;
}

interface LegacyCountData {
	id: number;
	coordinates?: {
		x: number; // longitude
		y: number; // latitude
	};
	metadata: {
		name: string;
		date: string;
		city: {
			id: number;
			name: string;
			state: string;
			full_state: string;
			rmr: boolean;
		};
		directions: {
			north: string;
			east: string;
			south: string;
			west: string;
		};
	};
	data: {
		sessions: Array<{
			session: string;
			start_time: string;
			end_time: string;
			total_cyclists: number;
			quantitative: {
				north_west: number;
				north_south: number;
				north_east: number;
				east_north: number;
				east_west: number;
				east_south: number;
				south_east: number;
				south_north: number;
				south_west: number;
				west_south: number;
				west_east: number;
				west_north: number;
			};
			characteristics: {
				cargo: number;
				helmet: number;
				juveniles: number;
				motor: number;
				other_active_modes: number;
				other_behaviors: number;
				others: number;
				rain: number;
				ride: number;
				service: number;
				shared_bike: number;
				sidewalk: number;
				women: number;
				wrong_way: number;
			};
		}>;
	};
}

/**
 * Transform legacy movement data from flat structure to directional pairs
 */
function transformMovements(
	quantitative: LegacyCountData["data"]["sessions"][0]["quantitative"],
) {
	return [
		{
			from: "north" as const,
			to: "west" as const,
			count: quantitative.north_west,
		},
		{
			from: "north" as const,
			to: "south" as const,
			count: quantitative.north_south,
		},
		{
			from: "north" as const,
			to: "east" as const,
			count: quantitative.north_east,
		},
		{
			from: "east" as const,
			to: "north" as const,
			count: quantitative.east_north,
		},
		{
			from: "east" as const,
			to: "west" as const,
			count: quantitative.east_west,
		},
		{
			from: "east" as const,
			to: "south" as const,
			count: quantitative.east_south,
		},
		{
			from: "south" as const,
			to: "east" as const,
			count: quantitative.south_east,
		},
		{
			from: "south" as const,
			to: "north" as const,
			count: quantitative.south_north,
		},
		{
			from: "south" as const,
			to: "west" as const,
			count: quantitative.south_west,
		},
		{
			from: "west" as const,
			to: "south" as const,
			count: quantitative.west_south,
		},
		{
			from: "west" as const,
			to: "east" as const,
			count: quantitative.west_east,
		},
		{
			from: "west" as const,
			to: "north" as const,
			count: quantitative.west_north,
		},
	].filter((movement) => movement.count > 0); // Only include movements that happened
}

/**
 * Seed cyclist counts data from JSON file (Git or S3)
 */
export async function seedCyclistCounts(config: DatabaseConfig = {}) {
	const db = await createConnectedDatabase(config);
	const useS3 = process.env.SEED_DATA_USE_S3 === "true";

	try {
		console.log("🌱 Starting cyclist counts seed...");
		console.log(
			`📍 Data source: ${useS3 ? "S3 (DigitalOcean Spaces)" : "Local files"}\n`,
		);

		// Load the JSON data
		let legacyData: LegacyCountData[];

		if (useS3) {
			// Load from S3 using manifest
			const manifestData = await loadManifest();
			const loader = createSeedDataLoader({ useS3 });
			const cyclistCountsDataset = manifestData.datasets["cyclist-counts"];

			if (!cyclistCountsDataset?.s3?.files?.[0]) {
				throw new Error("Cyclist counts file not found in manifest");
			}

			const fileInfo = cyclistCountsDataset.s3.files[0];
			console.log(`📂 Loading from S3: ${fileInfo.key}`);
			legacyData = await loader.loadJSON(
				{
					type: "s3",
					path: fileInfo.key,
					bucket: cyclistCountsDataset.s3.bucket,
				},
				fileInfo.checksum,
			);
		} else {
			// Load from local file
			const dataPath = join(
				import.meta.dirname,
				"../seed-data/cyclist-counts/data.json",
			);
			const rawData = await readFile(dataPath, "utf-8");
			legacyData = JSON.parse(rawData);
		}

		console.log(`📊 Found ${legacyData.length} counting events to import`);

		let locationsCreated = 0;
		let eventsCreated = 0;
		let sessionsCreated = 0;
		let movementsCreated = 0;

		for (const item of legacyData) {
			// 1. Validate coordinates (x = longitude, y = latitude)
			const lng = item.coordinates?.x;
			const lat = item.coordinates?.y;
			const hasValidCoordinates =
				lat !== null &&
				lat !== undefined &&
				lng !== null &&
				lng !== undefined &&
				lat !== 0 &&
				lng !== 0;

			if (!hasValidCoordinates) {
				console.log(
					`  ⚠️  Skipping "${item.metadata.name}" - missing or invalid coordinates (lat: ${lat}, lng: ${lng})`,
				);
				continue;
			}

			// 2. Create or get location
			const locationData = {
				name: item.metadata.name,
				city: item.metadata.city.name,
				state: item.metadata.city.state,
				latitude: lat.toString(),
				longitude: lng.toString(),
				metadata: {
					ibge_city_id: item.metadata.city.id,
					state_full: item.metadata.city.full_state,
					is_rmr: item.metadata.city.rmr,
					directions: item.metadata.directions,
				},
			};

			// Check if location already exists
			const existingLocation = await db
				.select()
				.from(cyclistCountsSchema.countingLocations)
				.where(
					eq(cyclistCountsSchema.countingLocations.name, locationData.name),
				)
				.limit(1);

			let locationId: number;

			if (existingLocation.length > 0 && existingLocation[0]) {
				locationId = existingLocation[0].id;
				console.log(`  ↪ Using existing location: ${locationData.name}`);
			} else {
				const [newLocation] = await db
					.insert(cyclistCountsSchema.countingLocations)
					.values(locationData)
					.returning();

				if (!newLocation) {
					throw new Error(`Failed to create location: ${locationData.name}`);
				}

				locationId = newLocation.id;
				locationsCreated++;
				console.log(`  ✓ Created location: ${locationData.name}`);
			}

			// 2. Create counting event
			const eventDate = new Date(item.metadata.date);
			const sessions = item.data.sessions;

			if (!sessions || sessions.length === 0) {
				console.log(
					`  ⚠ Skipping event with no sessions: ${item.metadata.name}`,
				);
				continue;
			}

			// Calculate event summary statistics
			const totalCyclists = sessions.reduce(
				(sum, s) => sum + s.total_cyclists,
				0,
			);
			const maxHourCyclists = Math.max(
				...sessions.map((s) => s.total_cyclists),
			);

			// Get start and end times from first and last session
			const firstSession = sessions[0];
			const lastSession = sessions[sessions.length - 1];

			if (!firstSession || !lastSession) {
				console.log(
					`  ⚠ Skipping event with invalid sessions: ${item.metadata.name}`,
				);
				continue;
			}

			const startTime =
				new Date(firstSession.start_time).toTimeString().split(" ")[0] ||
				"00:00:00";
			const endTime =
				new Date(lastSession.end_time).toTimeString().split(" ")[0] ||
				"23:59:59";

			const eventData: typeof cyclistCountsSchema.countingEvents.$inferInsert =
				{
					location_id: locationId,
					counting_date: eventDate.toISOString().split("T")[0] || "",
					start_time: startTime,
					end_time: endTime,
					total_cyclists: totalCyclists,
					max_hour_cyclists: maxHourCyclists,
				};

			// Check if event already exists for this location and date
			const existingEvent = await db
				.select()
				.from(cyclistCountsSchema.countingEvents)
				.where(
					and(
						eq(cyclistCountsSchema.countingEvents.location_id, locationId),
						eq(
							cyclistCountsSchema.countingEvents.counting_date,
							eventData.counting_date,
						),
					),
				)
				.limit(1);

			let event: typeof cyclistCountsSchema.countingEvents.$inferSelect;

			if (existingEvent.length > 0 && existingEvent[0]) {
				event = existingEvent[0];
				console.log(
					`  ↪ Using existing event on ${eventData.counting_date} (${totalCyclists} cyclists)`,
				);
				// Skip creating sessions for existing events
				continue;
			} else {
				const [newEvent] = await db
					.insert(cyclistCountsSchema.countingEvents)
					.values(eventData)
					.returning();

				if (!newEvent) {
					throw new Error(`Failed to create event for ${item.metadata.name}`);
				}

				event = newEvent;
				eventsCreated++;
				console.log(
					`  ✓ Created event on ${eventDate.toISOString().split("T")[0]} (${totalCyclists} cyclists)`,
				);
			}

			// 3. Create sessions and movements
			for (const sessionData of sessions) {
				const [session] = await db
					.insert(cyclistCountsSchema.countingSessions)
					.values({
						event_id: event.id,
						session_label: sessionData.session,
						start_time: new Date(sessionData.start_time),
						end_time: new Date(sessionData.end_time),
						total_cyclists: sessionData.total_cyclists,
						characteristics: sessionData.characteristics,
					})
					.returning();

				if (!session) {
					throw new Error(`Failed to create session: ${sessionData.session}`);
				}

				sessionsCreated++;

				// 4. Create movements for this session
				const movements = transformMovements(sessionData.quantitative);

				if (movements.length > 0) {
					await db.insert(cyclistCountsSchema.sessionMovements).values(
						movements.map((m) => ({
							session_id: session.id,
							from_direction: m.from,
							to_direction: m.to,
							count: m.count,
						})),
					);
					movementsCreated += movements.length;
				}
			}
		}

		console.log("\n✅ Seed completed successfully!");
		console.log(`   📍 Locations: ${locationsCreated} created`);
		console.log(`   📅 Events: ${eventsCreated} created`);
		console.log(`   ⏰ Sessions: ${sessionsCreated} created`);
		console.log(`   🔄 Movements: ${movementsCreated} created`);
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
	seedCyclistCounts().catch((error) => {
		console.error("Seed failed:", error);
		process.exit(1);
	});
}
