import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "./index.js";

// ============================================================================
// Types
// ============================================================================

interface CatalogRow {
	law_code: string;
	canonical_description: string;
	category: string;
	total_rows: string;
}

interface MappingRow {
	raw_description: string;
	canonical_description: string;
	frequency: string;
}

function parseCSV(raw: string): CatalogRow[] {
	const lines = raw.trim().split("\n");
	return lines.slice(1).map((line) => {
		const values = parseCsvLine(line);
		return {
			law_code: values[0] || "",
			canonical_description: values[1] || "",
			category: values[2] || "",
			total_rows: values[3] || "",
		};
	});
}

function parseMappingCSV(raw: string): MappingRow[] {
	const lines = raw.trim().split("\n");
	return lines.slice(1).map((line) => {
		const values = parseCsvLine(line);
		return {
			raw_description: values[0] || "",
			canonical_description: values[1] || "",
			frequency: values[2] || "",
		};
	});
}

function parseCsvLine(line: string): string[] {
	const values: string[] = [];
	let current = "";
	let inQuotes = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (ch === '"') {
			inQuotes = !inQuotes;
		} else if (ch === "," && !inQuotes) {
			values.push(current.trim());
			current = "";
		} else {
			current += ch;
		}
	}
	values.push(current.trim());
	return values.map((v) => v.replace(/^"|"$/g, ""));
}

// ============================================================================
// Build code -> law lookup from DB
// ============================================================================

async function buildCodeLawMap(): Promise<Map<string, string>> {
	const rows = await db.execute(sql`
		SELECT DISTINCT violation_code, MAX(law_code) as law_code
		FROM traffic_violations
		WHERE law_code IS NOT NULL
		GROUP BY violation_code
	`);
	const codeToLaw = new Map<string, string>();
	const dbRows = (rows as any).rows || rows;
	for (const row of dbRows) {
		const code = String(row.violation_code || "").trim();
		const law = String(row.law_code || "").trim();
		if (code && law) codeToLaw.set(code, law);
	}
	return codeToLaw;
}

function normalizeLaw(law: string): string {
	return law
		.toLowerCase()
		.replace(/,\s*/g, " ")
		.replace(/\s+/g, " ")
		.replace(/(?<![ú§])nico/gi, "único")
		.replace(/§\s*único/gi, "parágrafo único")
		.replace(/pargrafo/gi, "parágrafo")
		.replace(/alnea/gi, "alínea")
		.replace(/\balínea\s+\w/gi, "")
		.replace(/\s+c\/c\s+.*$/i, "")
		.replace(/art\.(\d)/g, "art. $1")
		.replace(/\s*do\s+ctb\.?\s*$/i, "")
		.replace(/\binciso\b/gi, "inc.")
		.replace(/,?\s*§?\s*1\s*$/gi, " parágrafo 1")
		.replace(/§\s*1[º°]\s*/gi, "parágrafo 1 ")
		.replace(/§\s*2[º°]\s*/gi, "parágrafo 2 ")
		.trim();
}

// ============================================================================
// Seed infraction_catalog with canonical descriptions + known variants
// ============================================================================

async function seedInfractionCatalog() {
	console.log("Seeding infraction_catalog...\n");

	const catalogPath = join(
		import.meta.dirname,
		"../../src/db/infraction_catalog_classified.csv",
	);
	const mappingPath = join(
		import.meta.dirname,
		"../../src/db/descricao_mapping.csv",
	);

	const catalogRaw = await readFile(catalogPath, "utf-8");
	const catalog = parseCSV(catalogRaw).filter((r) => r.category);
	console.log(`  Loaded ${catalog.length} classified catalog rows`);

	const mappingRaw = await readFile(mappingPath, "utf-8");
	const mapping = parseMappingCSV(mappingRaw);
	console.log(`  Loaded ${mapping.length} description mappings`);

	// Build canonical -> [variants] lookup from mapping
	const variantsByCanonical = new Map<string, string[]>();
	for (const m of mapping) {
		const canonical = m.canonical_description;
		const raw = m.raw_description;
		if (!variantsByCanonical.has(canonical)) {
			variantsByCanonical.set(canonical, []);
		}
		const arr = variantsByCanonical.get(canonical)!;
		if (!arr.includes(raw)) arr.push(raw);
	}

	// Build code -> law mapping for resolving violation_code
	const codeToLaw = await buildCodeLawMap();
	const lawToCodes = new Map<string, string[]>();
	for (const [code, law] of codeToLaw) {
		const norm = normalizeLaw(law);
		if (!lawToCodes.has(norm)) lawToCodes.set(norm, []);
		lawToCodes.get(norm)!.push(code);
	}
	console.log(`  ${codeToLaw.size} codes mapped to ${lawToCodes.size} normalized laws`);

	// Build inserts for infraction_catalog
	const inserts: Array<{
		violation_code: string;
		law_code: string;
		canonical_description: string;
		known_variants: string[];
		category: string;
		total_rows: number;
	}> = [];

	for (const row of catalog) {
		const normLaw = normalizeLaw(row.law_code);
		const codes = lawToCodes.get(normLaw);
		if (!codes || codes.length === 0) continue;

		const variants = variantsByCanonical.get(row.canonical_description) || [];
		// Always ensure canonical_description itself is in the variants
		if (!variants.includes(row.canonical_description)) {
			variants.push(row.canonical_description);
		}
		if (variants.length === 0) {
			variants.push(row.canonical_description);
		}

		for (const code of codes) {
			inserts.push({
				violation_code: code,
				law_code: row.law_code,
				canonical_description: row.canonical_description,
				known_variants: variants,
				category: row.category,
				total_rows: Number.parseInt(row.total_rows) || 0,
			});
		}
	}

	console.log(`  ${inserts.length} rows to insert`);

	await db.execute(sql`TRUNCATE infraction_catalog RESTART IDENTITY CASCADE`);

	// Deduplicate: same (violation_code, canonical_description) → keep first
	const seen = new Set<string>();
	const deduped = inserts.filter((r) => {
		const key = `${r.violation_code}|${r.canonical_description}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
	console.log(`  ${deduped.length} unique rows after dedup`);

	const batchSize = 100;
	for (let i = 0; i < deduped.length; i += batchSize) {
		const batch = deduped.slice(i, i + batchSize);
		await db.execute(
			sql`INSERT INTO infraction_catalog (violation_code, law_code, canonical_description, known_variants, category, total_rows)
			    SELECT * FROM json_to_recordset(${JSON.stringify(batch)}::json)
			    AS x(violation_code text, law_code text, canonical_description text, known_variants text[], category text, total_rows integer)`,
		);
	}

	console.log(`  Inserted ${inserts.length} rows\n`);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
	console.log("Seed catalog pipeline\n");

	await seedInfractionCatalog();

	console.log("Pipeline complete.\n");
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("Seed failed:", err);
		process.exit(1);
	});

export { seedInfractionCatalog };
