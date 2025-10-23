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
	const header = lines[0]
		.split(",")
		.map((h) => h.replace(/^"|"$/g, "").toLowerCase());

	const records: Record<string, string | null>[] = [];

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i].trim();
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
				record[header[k]] = values[k];
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
) {
	// Helper to parse date in DDMMYYYY format
	const parseDate = (dateStr: string | null): string | null => {
		if (!dateStr || dateStr.length !== 8) return null;
		const day = dateStr.substring(0, 2);
		const month = dateStr.substring(2, 4);
		const year = dateStr.substring(4, 8);
		return `${year}-${month}-${day}`;
	};

	// Helper to parse integer
	const parseInt = (value: string | null): number | null => {
		if (!value) return null;
		const num = Number.parseInt(value, 10);
		return Number.isNaN(num) ? null : num;
	};

	return {
		// Identificação do óbito
		contador: parseInt(csvRecord.contador),
		tipobito: csvRecord.tipobito,
		dtobito: parseDate(csvRecord.dtobito),
		horaobito: csvRecord.horaobito,

		// Dados do falecido
		natural: csvRecord.natural,
		codmunnatu: parseInt(csvRecord.codmunnatu),
		dtnasc: parseDate(csvRecord.dtnasc),
		idade: parseInt(csvRecord.idade),
		sexo: csvRecord.sexo,
		racacor: csvRecord.racacor,
		estciv: csvRecord.estciv,

		// Escolaridade e ocupação
		esc: csvRecord.esc,
		esc2010: csvRecord.esc2010,
		seriescfal: csvRecord.seriescfal,
		ocup: csvRecord.ocup,

		// Localização
		codmunres: parseInt(csvRecord.codmunres),
		lococor: csvRecord.lococor,
		codestab: csvRecord.codestab,
		estabdescr: csvRecord.estabdescr,
		codmunocor: parseInt(csvRecord.codmunocor),

		// Causas da morte
		linhaa: csvRecord.linhaa,
		linhab: csvRecord.linhab,
		linhac: csvRecord.linhac,
		linhad: csvRecord.linhad,
		linhaii: csvRecord.linhaii,
		causabas: csvRecord.causabas || "UNKNOWN", // Required field
		causabas_o: csvRecord.causabas_o,
		cb_pre: csvRecord.cb_pre,

		// Circunstâncias do óbito
		circobito: csvRecord.circobito,
		acidtrab: csvRecord.acidtrab,
		fonte: csvRecord.fonte,
		origem: csvRecord.origem,

		// Procedimentos e investigação
		assistmed: csvRecord.assistmed,
		exame: csvRecord.exame,
		cirurgia: csvRecord.cirurgia,
		necropsia: csvRecord.necropsia,
		dtinvestig: parseDate(csvRecord.dtinvestig),
		dtcadastro: parseDate(csvRecord.dtcadastro),
		dtrecebim: parseDate(csvRecord.dtrecebim),

		// Controle e versão
		numerolote: csvRecord.numerolote,
		tppos: csvRecord.tppos,
		atestante: csvRecord.atestante,
		stcodifica: csvRecord.stcodifica,
		codificado: csvRecord.codificado,
		versaosist: csvRecord.versaosist,
		versaoscb: csvRecord.versaoscb,

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
		const dbRecords = batch.map((record) =>
			convertToDbRecord(record, year, batchId),
		);

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

		console.log("=" .repeat(60));
		console.log("🎉 Seeding completed successfully!");
		console.log(`   Total records inserted: ${totalInserted}`);
		console.log(`   Total errors: ${totalErrors}`);
		console.log("=" .repeat(60));
	} catch (error) {
		console.error("❌ Error seeding database:", error);
		process.exit(1);
	} finally {
		process.exit(0);
	}
}

seed();

