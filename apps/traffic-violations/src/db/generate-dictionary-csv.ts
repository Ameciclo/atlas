import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "./index.js";

// ============================================================================
// Pre-classification based on existing violation_categories + keyword matching
// ============================================================================

type CategoryInfo = {
	defaultCategory: string;
	keywordCategories: Array<{ kw: string; cat: string }>;
};

async function loadExistingCategories(): Promise<Map<string, CategoryInfo>> {
	const rows = await db.execute(sql`
		SELECT violation_code, category, description_keyword
		FROM violation_categories
		ORDER BY violation_code, description_keyword NULLS FIRST
	`);

	const map = new Map<string, CategoryInfo>();
	for (const row of (rows as any).rows || rows) {
		const code = row.violation_code as string;
		const cat = row.category as string;
		const kw = row.description_keyword as string | null;

		if (!map.has(code)) {
			map.set(code, { defaultCategory: cat, keywordCategories: [] });
		}
		if (kw) {
			map.get(code)!.keywordCategories.push({ kw: kw.toLowerCase(), cat });
		}
	}
	return map;
}

function classify(
	code: string,
	description: string,
	categories: Map<string, CategoryInfo>,
): string {
	const info = categories.get(code);
	if (!info) return "";

	const descLower = description.toLowerCase();

	// Check keyword matches first - they take precedence over default
	for (const { kw, cat } of info.keywordCategories) {
		if (descLower.includes(kw)) {
			return cat;
		}
	}

	// Fall back to default category
	return info.defaultCategory;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
	console.log("📋 Loading existing categories...");
	const categories = await loadExistingCategories();
	console.log(`   ${categories.size} codes with categories loaded`);

	console.log("📊 Fetching all distinct (code, description) pairs...");
	const pairs = await db.execute(sql`
		SELECT 
			violation_code,
			MAX(law_code) as law_code,
			description,
			COUNT(*) as total
		FROM traffic_violations
		GROUP BY violation_code, description
		ORDER BY COUNT(*) DESC
	`);

	const rows = (pairs as any).rows || pairs;
	console.log(`   ${rows.length} distinct pairs found\n`);

	// Build CSV
	let csv = "our_code,cttu_code,law_code,description,category,total\n";
	let classified = 0;
	let unclassified = 0;

	for (const row of rows) {
		const cttu = row.violation_code as string;
		const law = (row.law_code as string).replace(/,/g, ";"); // escape commas for CSV
		const desc = (row.description as string).replace(/"/g, '""'); // escape quotes
		const total = row.total as number;
		const cat = classify(cttu, desc, categories);

		if (cat) classified++;
		else unclassified++;

		csv += `,"${cttu}","${law}","${desc}","${cat}",${total}\n`;
	}

	const path = join(
		import.meta.dirname,
		"../../src/db/dicionario_infracoes.csv",
	);
	await writeFile(path, csv, "utf-8");

	console.log(`✅ CSV gerado: ${path}`);
	console.log(`   ${rows.length} linhas`);
	console.log(`   ${classified} pré-classificadas`);
	console.log(`   ${unclassified} sem classificação (preencher manualmente)`);
	console.log(
		"\n   Colunas: our_code, cttu_code, law_code, description, category, total",
	);
	console.log(
		"   Preencha as colunas 'our_code' e ajuste 'category' conforme necessário.",
	);
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("Failed:", err);
		process.exit(1);
	});
