import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "./index.js";
import { violationCategories } from "./schema.js";
import { sql } from "drizzle-orm";

// ============================================================================
// Normalize law_code for matching (DB side: remove commas, clean "§")
// ============================================================================

function normalizeLaw(law: string): string {
	return law
		.toLowerCase()
		.replace(/,\s*/g, " ")
		.replace(/\s+/g, " ")
		// "nico" -> "único" only if not preceded by ú/§ (avoid "único" -> "úúnico")
		.replace(/(?<![ú§])nico/gi, "único")
		.replace(/§\s*único/gi, "parágrafo único")
		.replace(/pargrafo/gi, "parágrafo")
		.replace(/alnea/gi, "alínea")
		.replace(/alínea\s+\w/gi, "")
		.replace(/\s+c\/c\s+.*$/i, "")
		// Fix missing space: "Art.168" → "Art. 168"
		.replace(/art\.(\d)/g, "art. $1")
		.trim();
}

// Manual overrides for DB codes that don't match CSV
const MANUAL_MAPPINGS: Record<string, string> = {
	"7064": "Segurança viária",    // Art. 244 Inc. IV - farol apagado
	"6416": "Administrativas/documentais", // Art. 221 parágrafo único
	"6920": "Administrativas/documentais", // Art. 233 c/c 123
	"7242": "Segurança viária",    // Art. 250 I b
	"7277": "Segurança viária",    // Art. 250 Inc. II
	"7722": "Segurança viária",    // Art. 250 I e
	"7110": "Ciclistas",           // Art. 244 §1º alínea a - ciclo passageiro
	"7137": "Ciclistas",           // Art. 244 §1º alínea c - ciclo crianças
	"7633": "Segurança viária",    // Art. 252 §único - celular
	"7765": "Segurança viária",    // Art. 278 § único c/c 210
	"7670": "Ciclistas",           // Art. 182 Inc. XI - parar sobre ciclovia
	"7684": "Segurança viária",    // Art. 244 Inc. X - capacete sem viseira
	"7714": "Segurança viária",    // Art. 244 Inc. XI - passageiro sem viseira
};

// ============================================================================
// CSV parsing
// ============================================================================

interface CsvRow {
	base_legal: string;
	artigo: string;
	inciso: string;
	gravidade: string;
	descricao: string;
	classificacao: string;
	observacoes: string;
}

async function loadCSV(): Promise<CsvRow[]> {
	const path = join(import.meta.dirname, "../../src/db/tabela_infracoes_ctb_classificada_pedestres_ciclistas_separados.csv");
	const raw = await readFile(path, "utf-8");
	const lines = raw.trim().split("\n");

	return lines.slice(1).map((line) => {
		// Handle quoted CSV fields
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

		return {
			base_legal: values[0] || "",
			artigo: values[1] || "",
			inciso: values[2] || "",
			gravidade: values[3] || "",
			descricao: values[4] || "",
			classificacao: values[5] || "",
			observacoes: values[6] || "",
		};
	});
}

// ============================================================================
// Keyword-based sub-classification for codes that cover multiple categories
// ============================================================================

interface KeywordRule {
	violation_code: string;
	keyword: string;
	category: string;
}

function buildKeywordRules(): KeywordRule[] {
	return [
		// Art. 181 Inc. VIII (code 5452) - estacionar em passeio/ciclovia/gramado
		{ violation_code: "5452", keyword: "passeio", category: "Pedestres" },
		{ violation_code: "5452", keyword: "pedestre", category: "Pedestres" },
		{ violation_code: "5452", keyword: "ciclovia", category: "Ciclistas" },
		{ violation_code: "5452", keyword: "ciclofaixa", category: "Ciclistas" },
		{ violation_code: "5452", keyword: "gramados", category: "Estacionamento/uso da via" },
		{ violation_code: "5452", keyword: "jardim", category: "Estacionamento/uso da via" },
		{ violation_code: "5452", keyword: "canteiros", category: "Estacionamento/uso da via" },
		{ violation_code: "5452", keyword: "ilhas", category: "Estacionamento/uso da via" },
		{ violation_code: "5452", keyword: "refúgios", category: "Estacionamento/uso da via" },
		{ violation_code: "5452", keyword: "marcas de canalização", category: "Estacionamento/uso da via" },

		// Art. 193 (code 5819) - transitar em calçada/ciclovia
		{ violation_code: "5819", keyword: "calçadas", category: "Pedestres" },
		{ violation_code: "5819", keyword: "passeios", category: "Pedestres" },
		{ violation_code: "5819", keyword: "passarelas", category: "Pedestres" },
		{ violation_code: "5819", keyword: "ciclovias", category: "Ciclistas" },
		{ violation_code: "5819", keyword: "ciclofaixas", category: "Ciclistas" },
		{ violation_code: "5819", keyword: "acostamentos", category: "Segurança viária" },

		// Art. 182 Inc. VI (code 5622) - parar no passeio/faixa pedestre
		{ violation_code: "5622", keyword: "passeio", category: "Pedestres" },
		{ violation_code: "5622", keyword: "pedestres", category: "Pedestres" },

		// Art. 214 Inc. I (code 6122) - preferência a pedestre/ciclista
		{ violation_code: "6122", keyword: "pedestre", category: "Pedestres" },
		{ violation_code: "6122", keyword: "não motorizado", category: "Ciclistas" },

		// Art. 206 Inc. III (codes 6017, 6025) - retorno sobre calçada/canteiro
		{ violation_code: "6017", keyword: "calçada", category: "Pedestres" },
		{ violation_code: "6017", keyword: "passeio", category: "Pedestres" },
		{ violation_code: "6017", keyword: "faixas de pedestres", category: "Pedestres" },
		{ violation_code: "6017", keyword: "não motorizados", category: "Ciclistas" },
	];

	// Note: the default category from CSV applies when no keyword matches
}

// ============================================================================
// Main seed logic
// ============================================================================

async function seed() {
	console.log("🌱 Seeding violation_categories...");

	// 1. Load CSV
	const csvRows = await loadCSV();
	console.log(`   Loaded ${csvRows.length} rows from CSV`);

	// 2. Normalize CSV base_legal
	const csvMap = new Map<string, Set<string>>(); // law_norm → set of categories
	for (const row of csvRows) {
		const lawNorm = normalizeLaw(row.base_legal);
		if (!csvMap.has(lawNorm)) csvMap.set(lawNorm, new Set());
		csvMap.get(lawNorm)!.add(row.classificacao);
	}
	console.log(`   ${csvMap.size} unique normalized law_codes in CSV`);

	// 3. Get DB law_codes
	const dbCodes = await db.execute(sql`
		SELECT DISTINCT violation_code,
		       MAX(law_code) as law_code
		FROM traffic_violations
		WHERE law_code IS NOT NULL
		GROUP BY violation_code
	`);
	const dbRows = (dbCodes as any).rows || dbCodes;

	console.log(`   ${dbRows.length} unique violation_codes in DB`);

	// 4. Match DB → CSV
	const keywordRules = buildKeywordRules();
	const inserts: Array<{
		violation_code: string;
		law_code: string;
		description_keyword: string | null;
		category: string;
	}> = [];

	let matched = 0;
	let unmatched = 0;

	for (const row of dbRows) {
		const dbLawNorm = normalizeLaw(row.law_code as string);
		const categories = csvMap.get(dbLawNorm);
		const manualCat = MANUAL_MAPPINGS[row.violation_code as string];

		if (categories && categories.size > 0) {
			// Check if this code needs keyword-based sub-classification
			const codeRules = keywordRules.filter((r) => r.violation_code === row.violation_code);

			if (codeRules.length > 0) {
				// Insert keyword-based rules
				for (const rule of codeRules) {
					inserts.push({
						violation_code: row.violation_code as string,
						law_code: row.law_code as string,
						description_keyword: rule.keyword,
						category: rule.category,
					});
				}
				// Also insert the primary CSV categories (without keyword)
				for (const cat of categories) {
					inserts.push({
						violation_code: row.violation_code as string,
						law_code: row.law_code as string,
						description_keyword: null,
						category: cat,
					});
				}
			} else {
				// Simple 1:1 mapping
				for (const cat of categories) {
					inserts.push({
						violation_code: row.violation_code as string,
						law_code: row.law_code as string,
						description_keyword: null,
						category: cat,
					});
				}
			}
			matched++;
		} else if (manualCat) {
			inserts.push({
				violation_code: row.violation_code as string,
				law_code: row.law_code as string,
				description_keyword: null,
				category: manualCat,
			});
			matched++;
		} else {
			if (unmatched < 10) {
				console.log(`   ⚠ UNMATCHED: ${row.violation_code} (${row.law_code} → "${dbLawNorm}")`);
			}
			unmatched++;
		}
	}

	console.log(`   Matched: ${matched}, Unmatched: ${unmatched}`);

	// 5. Insert
	await db.delete(violationCategories);

	const batchSize = 200;
	for (let i = 0; i < inserts.length; i += batchSize) {
		const batch = inserts.slice(i, i + batchSize);
		await db.insert(violationCategories).values(batch as any);
	}

	console.log(`   ✓ Inserted ${inserts.length} rows into violation_categories`);

	// 6. Summary
	const [total] = await db.select({ count: sql<number>`count(*)` }).from(violationCategories);
	const byCat = await db
		.select({ category: violationCategories.category, count: sql<number>`count(*)` })
		.from(violationCategories)
		.groupBy(violationCategories.category)
		.orderBy(sql`count(*) DESC`);

	console.log(`\n   Categories distribution:`);
	for (const c of byCat) {
		console.log(`     ${c.category}: ${c.count} entries`);
	}

	console.log("\n✅ Seed complete.\n");
}

seed()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("Seed failed:", err);
		process.exit(1);
	});
