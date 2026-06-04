import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { and, eq, sql } from "drizzle-orm";
import type { DatabaseConfig } from "./connection.js";
import { closeDatabase, createConnectedDatabase } from "./connection.js";
import * as cyclistCountsSchema from "./schemas/cyclist-counts/index.js";

// ============================================================================
// TYPES (same as seed-cyclist-counts.ts)
// ============================================================================

interface LegacyCountData {
	id: number;
	coordinates?: {
		x: number;
		y: number;
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

// ============================================================================
// HELPERS (same as seed-cyclist-counts.ts)
// ============================================================================

function transformMovements(
	quantitative: LegacyCountData["data"]["sessions"][0]["quantitative"],
) {
	return [
		{ from: "north" as const, to: "west" as const, count: quantitative.north_west },
		{ from: "north" as const, to: "south" as const, count: quantitative.north_south },
		{ from: "north" as const, to: "east" as const, count: quantitative.north_east },
		{ from: "east" as const, to: "north" as const, count: quantitative.east_north },
		{ from: "east" as const, to: "west" as const, count: quantitative.east_west },
		{ from: "east" as const, to: "south" as const, count: quantitative.east_south },
		{ from: "south" as const, to: "east" as const, count: quantitative.south_east },
		{ from: "south" as const, to: "north" as const, count: quantitative.south_north },
		{ from: "south" as const, to: "west" as const, count: quantitative.south_west },
		{ from: "west" as const, to: "south" as const, count: quantitative.west_south },
		{ from: "west" as const, to: "east" as const, count: quantitative.west_east },
		{ from: "west" as const, to: "north" as const, count: quantitative.west_north },
	].filter((movement) => movement.count > 0);
}

// ============================================================================
// SEED
// ============================================================================

export async function seedCyclistCountsImported(config: DatabaseConfig = {}) {
	const db = await createConnectedDatabase(config);

	try {
		console.log("🌱 Starting imported cyclist counts seed...\n");

		// Load imported data
		const dataPath = join(
			import.meta.dirname,
			"../seed-data/cyclist-counts/imported-data.json",
		);
		const rawData = await readFile(dataPath, "utf-8");
		const legacyData: LegacyCountData[] = JSON.parse(rawData);

		console.log(`📊 Found ${legacyData.length} counting events to import\n`);

		let locationsCreated = 0;
		let locationsReused = 0;
		let eventsCreated = 0;
		let eventsReused = 0;
		let sessionsCreated = 0;
		let movementsCreated = 0;

		for (const item of legacyData) {
			// 1. Validate coordinates
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
					`  ⚠️  Skipping "${item.metadata.name}" - missing coordinates`,
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
				locationsReused++;
				console.log(`  ↪ Using existing location: ${locationData.name}`);
			} else {
				// Fallback: dedup by coordinates (~10m tolerance)
				const coordTolerance = "0.0001";
				const nearbyLocations = await db
					.select()
					.from(cyclistCountsSchema.countingLocations)
					.where(
						sql`ABS(${cyclistCountsSchema.countingLocations.latitude}::decimal - ${locationData.latitude}::decimal) < ${coordTolerance}::decimal
						AND ABS(${cyclistCountsSchema.countingLocations.longitude}::decimal - ${locationData.longitude}::decimal) < ${coordTolerance}::decimal`,
					)
					.limit(1);

				if (nearbyLocations.length > 0 && nearbyLocations[0]) {
					locationId = nearbyLocations[0].id;
					locationsReused++;
					console.log(
						`  ↪ Reused by coords: "${locationData.name}" → existing "${nearbyLocations[0].name}"`,
					);
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
			}

			// 3. Create counting event
			const eventDate = new Date(item.metadata.date);
			const sessions = item.data.sessions;

			if (!sessions || sessions.length === 0) {
				console.log(`  ⚠ Skipping event with no sessions: ${item.metadata.name}`);
				continue;
			}

			const totalCyclists = sessions.reduce((sum, s) => sum + s.total_cyclists, 0);
			const maxHourCyclists = Math.max(...sessions.map((s) => s.total_cyclists));

			const firstSession = sessions[0];
			const lastSession = sessions[sessions.length - 1];

			if (!firstSession || !lastSession) {
				console.log(`  ⚠ Skipping event with invalid sessions: ${item.metadata.name}`);
				continue;
			}

			const startTime =
				new Date(firstSession.start_time).toTimeString().split(" ")[0] ||
				"00:00:00";
			const endTime =
				new Date(lastSession.end_time).toTimeString().split(" ")[0] ||
				"23:59:59";

			const eventData: typeof cyclistCountsSchema.countingEvents.$inferInsert = {
				location_id: locationId,
				counting_date: eventDate.toISOString().split("T")[0] || "",
				start_time: startTime,
				end_time: endTime,
				total_cyclists: totalCyclists,
				max_hour_cyclists: maxHourCyclists,
			};

			const existingEvent = await db
				.select()
				.from(cyclistCountsSchema.countingEvents)
				.where(
					and(
						eq(cyclistCountsSchema.countingEvents.location_id, locationId),
						eq(cyclistCountsSchema.countingEvents.counting_date, eventData.counting_date),
					),
				)
				.limit(1);

			let event: typeof cyclistCountsSchema.countingEvents.$inferSelect;

			if (existingEvent.length > 0 && existingEvent[0]) {
				event = existingEvent[0];
				eventsReused++;
				console.log(
					`  ↪ Using existing event on ${eventData.counting_date} (${totalCyclists} cyclists)`,
				);
				continue;
			}

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

			// 4. Create sessions and movements
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
		console.log(`   📍 Locations: ${locationsCreated} created, ${locationsReused} reused`);
		console.log(`   📅 Events: ${eventsCreated} created, ${eventsReused} reused`);
		console.log(`   ⏰ Sessions: ${sessionsCreated} created`);
		console.log(`   🔄 Movements: ${movementsCreated} created`);

		return {
			locationsCreated,
			locationsReused,
			eventsCreated,
			eventsReused,
			sessionsCreated,
			movementsCreated,
		};
	} catch (error) {
		console.error("❌ Error seeding data:", error);
		throw error;
	} finally {
		await closeDatabase(db);
	}
}

// ============================================================================
// CLI
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
	seedCyclistCountsImported().catch((error) => {
		console.error("Seed failed:", error);
		process.exit(1);
	});
}
