import "dotenv/config";
import { readFileSync } from "node:fs";
import { createConnectedDatabase, closeDatabase } from "@atlas/database";
import { emergencyCalls } from "@atlas/database/schemas/emergency-calls";

async function seed() {
	console.log("🌱 Seeding emergency calls database...");

	const db = await createConnectedDatabase();

	try {
		// Read the TSV file
		const tsvPath = "./src/db/sinistros-samu-tudo-final-ruas-corrigidas.tsv";
		const tsvContent = readFileSync(tsvPath, "utf-8");

		// Parse TSV content
		const lines = tsvContent.trim().split("\n");
		const headers = lines[0].split("\t");

		const records = lines.slice(1).map((line) => {
			const values = line.split("\t");
			const record: Record<string, string | null> = {};

			headers.forEach((header, index) => {
				const value = values[index]?.trim();
				record[header] = value === "" ? null : value;
			});

			return {
				original_id: parseInt(record._id || "0", 10),
				date: new Date(record.data || ""),
				time_minute: record.hora_minuto || "",
				municipality: record.municipio,
				neighborhood: record.bairro || null,
				address: record.endereco || null,
				call_origin: record.origem_chamado || null,
				origin_type: record.orig_tipo || null,
				subtype: record.subtipo || null,
				gender: record.sexo || null,
				age: record.idade ? parseInt(record.idade, 10) : null,
				finalization_reason: record.motivo_finalizacao || null,
				outcome_reason: record.motivo_desfecho || null,
				type: record.tipo || null,
				category: record.categoria || null,
				finalization_reason_normalized: record.motivo_fin_norm || null,
				outcome_reason_normalized: record.motivo_desf_norm || null,
				finalization_category: record.motivo_fin_cat || null,
				outcome_category: record.motivo_desf_cat || null,
				pcr_address: record.endereco_pcr || null,
			};
		});

		// Insert records in batches
		const batchSize = 100;
		for (let i = 0; i < records.length; i += batchSize) {
			const batch = records.slice(i, i + batchSize);
			await db.insert(emergencyCalls).values(batch);
			console.log(
				`✅ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}`,
			);
		}

		console.log(
			`🎉 Successfully seeded ${records.length} emergency call records!`,
		);
	} catch (error) {
		console.error("❌ Error seeding database:", error);
		throw error;
	} finally {
		await closeDatabase(db);
	}
}

seed()
	.then(() => {
		console.log("✅ Seeding completed successfully");
		process.exit(0);
	})
	.catch((error) => {
		console.error("❌ Seeding failed:", error);
		process.exit(1);
	});
