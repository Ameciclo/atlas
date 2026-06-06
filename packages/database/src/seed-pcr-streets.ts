import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import type { DatabaseConfig } from "./connection.js";
import { closeDatabase, createConnectedDatabase } from "./connection.js";

interface GeoJSONFeature {
	type: "Feature";
	properties: {
		OBJECTID: number;
		CLOGRACODI: number;
		NLOGRACONC: string;
		NLGPAVOFIC: string;
		NLGPAVRESU: string;
		FLGPAVINDP: string;
		INDPAV: string;
		CT: string | null;
		NMPERIMETR: string | null;
		NMTPVIA: string | null;
		TTRECHOSUL: string;
		"DB2GSE.Sde": number;
	};
	geometry: {
		type: "MultiLineString";
		coordinates: number[][][];
	};
}

interface GeoJSONData {
	type: "FeatureCollection";
	features: GeoJSONFeature[];
}

/**
 * Seed PCR streets data from GeoJSON file
 */
export async function seedPcrStreets(config: DatabaseConfig = {}) {
	const db = await createConnectedDatabase(config);

	try {
		console.log("🌱 Starting PCR streets seed...");

		const dataPath = join(
			import.meta.dirname,
			"../../../apps/traffic-violations/src/db/Trechos de Logradouros.geojson",
		);

		const geoJsonData = await readFile(dataPath, "utf-8");
		const data: GeoJSONData = JSON.parse(geoJsonData);

		console.log(`📊 Found ${data.features.length} street segments to import`);

		let streetsCreated = 0;
		const batchSize = 100;

		for (let i = 0; i < data.features.length; i += batchSize) {
			const batch = data.features.slice(i, i + batchSize);
			const _streetsToInsert = [];

			for (const feature of batch) {
				const props = feature.properties;
				const geoJsonGeometry = {
					type: "MultiLineString",
					coordinates: feature.geometry.coordinates,
				};

				// Use Drizzle sql template for PostGIS function
				await db.execute(sql`
					INSERT INTO pcr_streets (
						object_id, clogra_codi, nlogra_conc, nlgpav_ofic, nlgpav_resu,
						flgpav_indp, indpav, ct, nm_perimetr, nm_tp_via,
						trecho_sul, db2gse_sde, coordinates, created_at, updated_at
					) VALUES (
						${Math.trunc(props.OBJECTID)}, ${Math.trunc(props.CLOGRACODI)}, ${props.NLOGRACONC}, ${props.NLGPAVOFIC}, ${props.NLGPAVRESU},
						${props.FLGPAVINDP}, ${props.INDPAV}, ${props.CT}, ${props.NMPERIMETR}, ${props.NMTPVIA},
						${props.TTRECHOSUL}, ${props["DB2GSE.Sde"]}, ST_GeomFromGeoJSON(${JSON.stringify(geoJsonGeometry)}), NOW(), NOW()
					) ON CONFLICT (object_id) DO NOTHING
				`);
			}

			streetsCreated += batch.length;
			console.log(
				`  ✓ Inserted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} street segments`,
			);
		}

		console.log("\n✅ Seed completed successfully!");
		console.log(`   🛣️  Street segments: ${streetsCreated} created`);
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
	seedPcrStreets().catch((error) => {
		console.error("Seed failed:", error);
		process.exit(1);
	});
}
