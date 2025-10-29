import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./index.js";
import { trafficDeaths } from "./schema.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// CSV parsing helper
function parseCSV(content: string): Record<string, string | null>[] {
	const lines = content.split("\n");
	if (lines.length < 2) return [];

	// Parse header
	const firstLine = lines[0];
	if (!firstLine) return [];

	const header = firstLine
		.split(",")
		.map((h) => h.replace(/^"|"$/g, "").toLowerCase());

	const records: Record<string, string | null>[] = [];

	for (let i = 1; i < lines.length; i++) {
		const currentLine = lines[i];
		if (!currentLine) continue;

		const line = currentLine.trim();
		if (!line) continue;

		const values: (string | null)[] = [];
		let currentValue = "";
		let insideQuotes = false;

		for (let j = 0; j < line.length; j++) {
			const char = line[j];

			if (char === '"') {
				insideQuotes = !insideQuotes;
			} else if (char === "," && !insideQuotes) {
				values.push(
					currentValue === "NA" || currentValue === "" ? null : currentValue,
				);
				currentValue = "";
			} else {
				currentValue += char;
			}
		}
		// Push the last value
		values.push(
			currentValue === "NA" || currentValue === "" ? null : currentValue,
		);

		if (values.length === header.length) {
			const record: Record<string, string | null> = {};
			for (let k = 0; k < header.length; k++) {
				const headerKey = header[k];
				const value = values[k];
				if (headerKey !== undefined) {
					record[headerKey] = value ?? null;
				}
			}
			records.push(record);
		}
	}

	return records;
}

// Convert CSV record to database record
function convertToDbRecord(
	csvRecord: Record<string, string | null>,
	year: number,
	batchId: string,
): {
	dtobito: string;
	causabas: string;
	[key: string]: string | number | null;
} | null {
	// Helper to parse date in DDMMYYYY format
	const parseDate = (dateStr: string | null | undefined): string | null => {
		if (!dateStr || dateStr.length !== 8) return null;
		const day = dateStr.substring(0, 2);
		const month = dateStr.substring(2, 4);
		const year = dateStr.substring(4, 8);
		return `${year}-${month}-${day}`;
	};

	// Helper to parse integer
	const parseInteger = (value: string | null | undefined): number | null => {
		if (!value) return null;
		const num = Number.parseInt(value, 10);
		return Number.isNaN(num) ? null : num;
	};

	// Parse required fields
	const dtobito = parseDate(csvRecord.dtobito);
	const causabas = csvRecord.causabas;

	// Skip records without required fields
	if (!dtobito || !causabas) {
		return null;
	}

	return {
		// Identificação do óbito
		contador: parseInteger(csvRecord.contador),
		tipobito: csvRecord.tipobito ?? null,
		dtobito,
		horaobito: csvRecord.horaobito ?? null,

		// Dados do falecido
		natural: csvRecord.natural ?? null,
		codmunnatu: parseInteger(csvRecord.codmunnatu),
		dtnasc: parseDate(csvRecord.dtnasc),
		idade: parseInteger(csvRecord.idade),
		sexo: csvRecord.sexo ?? null,
		racacor: csvRecord.racacor ?? null,
		estciv: csvRecord.estciv ?? null,

		// Escolaridade e ocupação
		esc: csvRecord.esc ?? null,
		esc2010: csvRecord.esc2010 ?? null,
		seriescfal: csvRecord.seriescfal ?? null,
		ocup: csvRecord.ocup ?? null,

		// Localização
		codmunres: parseInteger(csvRecord.codmunres),
		lococor: csvRecord.lococor ?? null,
		codestab: csvRecord.codestab ?? null,
		estabdescr: csvRecord.estabdescr ?? null,
		codmunocor: parseInteger(csvRecord.codmunocor),

		// Causas da morte
		linhaa: csvRecord.linhaa ?? null,
		linhab: csvRecord.linhab ?? null,
		linhac: csvRecord.linhac ?? null,
		linhad: csvRecord.linhad ?? null,
		linhaii: csvRecord.linhaii ?? null,
		causabas,
		causabas_o: csvRecord.causabas_o ?? null,
		cb_pre: csvRecord.cb_pre ?? null,

		// Circunstâncias do óbito
		circobito: csvRecord.circobito ?? null,
		acidtrab: csvRecord.acidtrab ?? null,
		fonte: csvRecord.fonte ?? null,
		origem: csvRecord.origem ?? null,

		// Procedimentos e investigação
		assistmed: csvRecord.assistmed ?? null,
		exame: csvRecord.exame ?? null,
		cirurgia: csvRecord.cirurgia ?? null,
		necropsia: csvRecord.necropsia ?? null,
		dtinvestig: parseDate(csvRecord.dtinvestig),
		dtcadastro: parseDate(csvRecord.dtcadastro),
		dtrecebim: parseDate(csvRecord.dtrecebim),

		// Controle e versão
		numerolote: csvRecord.numerolote ?? null,
		tppos: csvRecord.tppos ?? null,
		atestante: csvRecord.atestante ?? null,
		stcodifica: csvRecord.stcodifica ?? null,
		codificado: csvRecord.codificado ?? null,
		versaosist: csvRecord.versaosist ?? null,
		versaoscb: csvRecord.versaoscb ?? null,

		// Metadados internos
		data_year: year,
		import_batch: batchId,
	};
}

async function seedYear(year: number, batchId: string) {
	const csvPath = join(__dirname, `mortes_transito_${year}.csv`);

	console.log(`📂 Reading CSV file: ${csvPath}`);
	const csvContent = readFileSync(csvPath, "utf-8");

	console.log(`📊 Parsing CSV data for year ${year}...`);
	const records = parseCSV(csvContent);
	console.log(`   Found ${records.length} records`);

	console.log(`💾 Inserting records into database...`);
	let inserted = 0;
	let errors = 0;

	// Insert in batches of 100 to avoid memory issues
	const batchSize = 100;
	for (let i = 0; i < records.length; i += batchSize) {
		const batch = records.slice(i, i + batchSize);
		const dbRecords = batch
			.map((record) => convertToDbRecord(record, year, batchId))
			.filter(
				(record): record is NonNullable<typeof record> => record !== null,
			);

		if (dbRecords.length === 0) continue;

		try {
			await db.insert(trafficDeaths).values(dbRecords);
			inserted += dbRecords.length;

			// Progress indicator
			if (inserted % 1000 === 0) {
				console.log(`   Inserted ${inserted}/${records.length} records...`);
			}
		} catch (error) {
			console.error(`   Error inserting batch at index ${i}:`, error);
			errors += batch.length;
		}
	}

	console.log(
		`✅ Year ${year} completed: ${inserted} inserted, ${errors} errors\n`,
	);
	return { inserted, errors };
}

async function seed() {
	const batchId = `seed-${new Date().toISOString()}`;
	const years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023];

	console.log("🚀 Starting traffic deaths data seeding...");
	console.log(`📦 Batch ID: ${batchId}\n`);

	let totalInserted = 0;
	let totalErrors = 0;

	try {
		for (const year of years) {
			const { inserted, errors } = await seedYear(year, batchId);
			totalInserted += inserted;
			totalErrors += errors;
		}

		console.log("=".repeat(60));
		console.log("🎉 Seeding completed successfully!");
		console.log(`   Total records inserted: ${totalInserted}`);
		console.log(`   Total errors: ${totalErrors}`);
		console.log("=".repeat(60));
	} catch (error) {
		console.error("❌ Error seeding database:", error);
		process.exit(1);
	} finally {
		process.exit(0);
	}
}

seed();
