import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
	closeDatabase,
	createConnectedDatabase,
	type DatabaseConfig,
} from "./connection.js";
import { sharedBikeStations } from "./schemas/shared-bike/index.js";
import { sql } from "drizzle-orm";

interface GeoJSONFeature {
	type: "Feature";
	properties: {
		"@id": string;
		amenity: string;
		capacity: string;
		name: string;
		network: string;
		operator: string;
		ref?: string;
		"operator:type"?: string;
		bicycle_rental?: string;
		fee?: string;
		"payment:credit_cards"?: string;
		"payment:debit_cards"?: string;
		alt_name?: string;
		[key: string]: unknown;
	};
	geometry: {
		type: "Point";
		coordinates: [number, number]; // [longitude, latitude]
	};
	id: string;
}

interface GeoJSONCollection {
	type: "FeatureCollection";
	features: GeoJSONFeature[];
}

export async function seedSharedBike(config?: DatabaseConfig) {
	const db = await createConnectedDatabase(config);

	try {
		console.log("🚴 Starting shared bike stations seed...");

		// Read GeoJSON file
		const geoJsonPath = join(
			import.meta.dirname,
			"../../../apps/shared-bike/src/db/bike-pe.geojson",
		);
		const geoJsonContent = await readFile(geoJsonPath, "utf-8");
		const geoData: GeoJSONCollection = JSON.parse(geoJsonContent);

		console.log(`📍 Found ${geoData.features.length} stations to process`);

		// Transform and insert data in batches
		const batchSize = 1000;
		let processed = 0;

		for (let i = 0; i < geoData.features.length; i += batchSize) {
			const batch = geoData.features.slice(i, i + batchSize);

			const stationsData = batch
				.map((feature) => {
					const props = feature.properties;

					// Validate feature structure
					if (
						!feature.geometry ||
						!feature.geometry.coordinates ||
						!Array.isArray(feature.geometry.coordinates)
					) {
						console.warn(
							`⚠️  Invalid geometry for station ${props.name || props["@id"]}`,
						);
						return null;
					}

					const [longitude, latitude] = feature.geometry.coordinates;

					// Validate coordinates are numbers
					if (
						typeof longitude !== "number" ||
						typeof latitude !== "number" ||
						Number.isNaN(longitude) ||
						Number.isNaN(latitude) ||
						!Number.isFinite(longitude) ||
						!Number.isFinite(latitude)
					) {
						console.warn(
							`⚠️  Invalid coordinates for station ${props.name || props["@id"]}: [${longitude}, ${latitude}]`,
						);
						return null;
					}

					// Validate required properties
					if (!props.name || !props["@id"]) {
						console.warn(
							`⚠️  Missing required properties for station: name=${props.name}, id=${props["@id"]}`,
						);
						return null;
					}

					// Validate capacity
					const capacity = props.capacity
						? Number.parseInt(props.capacity, 10)
						: 0;
					if (Number.isNaN(capacity)) {
						console.warn(
							`⚠️  Invalid capacity for station ${props.name}: ${props.capacity}`,
						);
						return null;
					}

					// Debug first few entries
					if (processed < 3) {
						console.log(
							`🔍 Debug station ${props.name}: coordinates=[${longitude}, ${latitude}]`,
						);
					}

					return {
						osm_id: props["@id"],
						name: props.name,
						ref: props.ref || null,
						coordinates: sql`ST_Point(${longitude}, ${latitude})`,
						capacity,
						network: props.network || "Unknown",
						operator: props.operator || "Tembici",
						operator_type: props["operator:type"] || null,
						bicycle_rental_type: props.bicycle_rental || null,
						fee: props.fee === "yes",
						payment_credit_cards: props["payment:credit_cards"] === "yes",
						payment_debit_cards: props["payment:debit_cards"] === "yes",
						alt_name: props.alt_name || null,
						properties: props, // Store all original properties as JSONB
					};
				})
				.filter(
					(station): station is NonNullable<typeof station> => station !== null,
				); // Remove null entries

			if (stationsData.length === 0) {
				console.warn(`⚠️  No valid stations in batch ${i / batchSize + 1}`);
				continue;
			}

			await db
				.insert(sharedBikeStations)
				.values(stationsData)
				.onConflictDoNothing();
			processed += batch.length;
			console.log(
				`✅ Processed ${processed}/${geoData.features.length} stations`,
			);
		}

		console.log("🎉 Shared bike stations seed completed successfully!");
	} catch (error) {
		console.error("❌ Error seeding shared bike stations:", error);
		throw error;
	} finally {
		await closeDatabase(db);
	}
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	seedSharedBike().catch(console.error);
}
