import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { DatabaseConfig } from "./connection.js";
import { closeDatabase, createConnectedDatabase } from "./connection.js";
import * as trafficTicketsSchema from "./schemas/traffic-tickets/index.js";

interface StreetData {
	_id: number;
	codlogradouro: number;
	nome_logradouro_concatenado: string;
	nome_oficial_logradouro: string;
	nome_logradouro_resumido: string;
	cod_indica_pavimentacao: string;
	desc_indica_pavimentacao: string;
	indica_corredor_transporte: string;
	indica_perimetral: string;
	codbairro: number;
	nomeBairro: string;
}

/**
 * Parse TSV line into StreetData
 */
function parseStreetLine(line: string): StreetData | null {
	const values = line.split("\t");
	if (values.length < 11) return null;

	return {
		_id: Number(values[0]) || 0,
		codlogradouro: Number(values[1]) || 0,
		nome_logradouro_concatenado: values[2] || "",
		nome_oficial_logradouro: values[3] || "",
		nome_logradouro_resumido: values[4] || "",
		cod_indica_pavimentacao: values[5] || "",
		desc_indica_pavimentacao: values[6] || "",
		indica_corredor_transporte: values[7] || "",
		indica_perimetral: values[8] || "",
		codbairro: Number(values[9]) || 0,
		nomeBairro: values[10] || "",
	};
}

/**
 * Seed official streets data from TSV file
 */
export async function seedOfficialStreets(config: DatabaseConfig = {}) {
	const db = await createConnectedDatabase(config);

	try {
		console.log("🌱 Starting official streets seed...");

		const basePath = join(import.meta.dirname, "../seed-data/traffic-tickets");
		const dataPath = join(basePath, "auxiliary", "logradouros-bairro.tsv");

		const tsvData = await readFile(dataPath, "utf-8");

		// Parse TSV data
		const lines = tsvData.trim().split("\n");
		const dataLines = lines.slice(1); // Skip header

		console.log(`📊 Found ${dataLines.length} streets to import`);

		let streetsCreated = 0;
		const batchSize = 1000;

		for (let i = 0; i < dataLines.length; i += batchSize) {
			const batch = dataLines.slice(i, i + batchSize);
			const streetsToInsert = [];

			for (const line of batch) {
				const streetData = parseStreetLine(line);
				if (!streetData || streetData.codlogradouro === 0) continue;

				streetsToInsert.push({
					code: streetData.codlogradouro,
					name_concatenated: streetData.nome_logradouro_concatenado,
					official_name: streetData.nome_oficial_logradouro,
					short_name: streetData.nome_logradouro_resumido,
					pavement_code: streetData.cod_indica_pavimentacao,
					pavement_description: streetData.desc_indica_pavimentacao,
				});
			}

			if (streetsToInsert.length > 0) {
				try {
					await db
						.insert(trafficTicketsSchema.officialStreets)
						.values(streetsToInsert)
						.onConflictDoNothing();
				} catch (insertError) {
					console.error(
						`❌ Error inserting batch ${Math.floor(i / batchSize) + 1}:`,
						insertError,
					);
					throw insertError;
				}
				streetsCreated += streetsToInsert.length;
				console.log(
					`  ✓ Inserted batch ${Math.floor(i / batchSize) + 1}: ${streetsToInsert.length} streets`,
				);
			}
		}

		console.log("\n✅ Seed completed successfully!");
		console.log(`   🛣️  Streets: ${streetsCreated} created`);
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
	seedOfficialStreets().catch((error) => {
		console.error("Seed failed:", error);
		process.exit(1);
	});
}
