import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { DatabaseConfig } from "./connection.js";
import { closeDatabase, createConnectedDatabase } from "./connection.js";
import * as trafficCrashesSchema from "./schemas/traffic-crashes/index.js";

interface GeoJSONFeature {
	type: "Feature";
	properties: {
		"N° de Feridos": number | null;
		"N° de Mortos": number | null;
		Data: string;
		HORA_00: string;
		ANO: number;
		MES: number;
		DIA: number;
		latitude: number;
		longitude: number;
		[key: string]: any;
	};
	geometry: {
		type: "Point";
		coordinates: [number, number];
	};
}

interface GeoJSONCollection {
	type: "FeatureCollection";
	features: GeoJSONFeature[];
}

export async function seedTrafficCrashes(config: DatabaseConfig = {}) {
	const db = await createConnectedDatabase(config);

	try {
		console.log("🚗 Starting traffic crashes seed...");

		// Read GeoJSON file
		const geoJsonPath = join(
			import.meta.dirname,
			"../../../apps/traffic-crashes/src/db/sinistros-geolocalizados-cttu-2017-2023.geojson",
		);
		const rawData = await readFile(geoJsonPath, "utf-8");
		const geoJsonData: GeoJSONCollection = JSON.parse(rawData);

	console.log(`📊 Found ${geoJsonData.features.length} crash records`);

	// Process and insert data
	const crashes = geoJsonData.features.map((feature) => {
		const { properties, geometry } = feature;
		
		// Build timestamp from date and hour
		const [day, month, year] = properties.Data.split("/").map(Number);
		const hour = parseInt(properties.HORA_00) || 0;
		const timestamp = new Date(year, month - 1, day, hour);

		// Extract coordinates
		const [longitude, latitude] = geometry.coordinates;
		const coordinates = `POINT(${longitude} ${latitude})`;

		// Build complementary data (all other properties)
		const complementaryData = { ...properties };
		delete complementaryData["N° de Feridos"];
		delete complementaryData["N° de Mortos"];
		delete complementaryData.Data;
		delete complementaryData.HORA_00;
		delete complementaryData.latitude;
		delete complementaryData.longitude;

		return {
			timestamp,
			n_injured: properties["N° de Feridos"] || 0,
			n_deaths: properties["N° de Mortos"] || 0,
			coordinates,
			complementary_data: complementaryData,
		};
	});

		// Insert in batches
		const batchSize = 1000;
		for (let i = 0; i < crashes.length; i += batchSize) {
			const batch = crashes.slice(i, i + batchSize);
			await db.insert(trafficCrashesSchema.geolocatedCrashes).values(batch);
			console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(crashes.length / batchSize)}`);
		}

		console.log("🎉 Traffic crashes seed completed!");
	} catch (error) {
		console.error("❌ Error seeding data:", error);
		throw error;
	} finally {
		await closeDatabase(db);
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	seedTrafficCrashes().catch((error) => {
		console.error("Seed failed:", error);
		process.exit(1);
	});
}