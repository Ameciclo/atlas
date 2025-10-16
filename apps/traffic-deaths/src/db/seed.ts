import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "csv-parse/sync";
import { db } from "./index.js";
import { traffic_deaths } from "./schema.js";

function parseDate(dateStr: string | undefined): Date | null {
	if (!dateStr || dateStr === "NA") return null;
	// DATASUS format: DDMMYYYY
	const day = dateStr.slice(0, 2);
	const month = dateStr.slice(2, 4);
	const year = dateStr.slice(4, 8);
	return new Date(`${year}-${month}-${day}`);
}

function parseInteger(value: string | undefined): number | null {
	if (!value || value === "NA") return null;
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? null : parsed;
}

function parseString(value: string | undefined): string | null {
	return !value || value === "NA" ? null : value;
}

async function loadCsvFile(filePath: string) {
	console.log(`📄 Loading ${path.basename(filePath)}...`);

	const csvContent = fs.readFileSync(filePath, "utf-8");
	const records = parse(csvContent, {
		columns: true,
		skip_empty_lines: true,
	});

	const batchSize = 1000;
	for (let i = 0; i < records.length; i += batchSize) {
		const batch = records.slice(i, i + batchSize);
		const data = batch
			.map((record: Record<string, string>) => ({
				contador: parseInteger(record.CONTADOR),
				tipobito: parseString(record.TIPOBITO),
				dtobito: parseDate(record.DTOBITO),
				horaobito: parseString(record.HORAOBITO),
				natural: parseString(record.NATURAL),
				codmunnatu: parseInteger(record.CODMUNNATU),
				dtnasc: parseDate(record.DTNASC),
				idade: parseInteger(record.IDADE),
				sexo: parseString(record.SEXO),
				racacor: parseString(record.RACACOR),
				estciv: parseString(record.ESTCIV),
				esc2010: parseString(record.ESC2010),
				seriescfal: parseString(record.SERIESCFAL),
				ocup: parseString(record.OCUP),
				codmunres: parseInteger(record.CODMUNRES),
				lococor: parseString(record.LOCOCOR),
				codmunocor: parseInteger(record.CODMUNOCOR),
				linhaa: parseString(record.LINHAA),
				linhab: parseString(record.LINHAB),
				linhac: parseString(record.LINHAC),
				linhad: parseString(record.LINHAD),
				linhaii: parseString(record.LINHAII),
				circobito: parseString(record.CIRCOBITO),
				acidtrab: parseString(record.ACIDTRAB),
				fonte: parseString(record.FONTE),
				origem: parseString(record.ORIGEM),
				esc: parseString(record.ESC),
				exame: parseString(record.EXAME),
				cirurgia: parseString(record.CIRURGIA),
				dtinvestig: parseDate(record.DTINVESTIG),
				causabas_o: parseString(record.CAUSABAS_O),
				causabas: parseString(record.CAUSABAS),
			}))
			.filter((item: { dtobito: Date | null }) => item.dtobito !== null);

		if (data.length > 0) {
			await db.insert(traffic_deaths).values(data);
			console.log(
				`  ✓ Inserted batch ${Math.floor(i / batchSize) + 1} (${data.length} records)`,
			);
		}
	}
}

async function seed() {
	console.log("🌱 Seeding DATASUS traffic deaths data...");

	try {
		const tmpDir = path.join(process.cwd(), "src", "db");
		const csvFiles = fs
			.readdirSync(tmpDir)
			.filter(
				(file) => file.startsWith("mortes_transito_") && file.endsWith(".csv"),
			)
			.sort();

		for (const csvFile of csvFiles) {
			const filePath = path.join(tmpDir, csvFile);
			await loadCsvFile(filePath);
		}

		console.log("✅ Database seeded successfully!");
	} catch (error) {
		console.error("❌ Seeding failed:", error);
		throw error;
	}
}

seed()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
