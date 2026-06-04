import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "./index.js";

interface CatalogRow {
	id: number;
	law_code: string;
	canonical_description: string;
	known_variants: string[];
	category: string;
	differentiation: string | null;
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

function parseCatalogCSV(raw: string): CatalogRow[] {
	const lines = raw.trim().split("\n");
	return lines.slice(1).map((line) => {
		const values = parseCsvLine(line);
		let variants: string[];
		try {
			variants = JSON.parse(values[3] || "[]");
		} catch {
			variants = [values[3] || ""];
		}
		const diff = values[5]?.trim() || null;
		return {
			id: Number(values[0]) || 0,
			law_code: values[1] || "",
			canonical_description: values[2] || "",
			known_variants: variants,
			category: values[4] || "",
			differentiation: diff,
		};
	}).filter((r) => r.id > 0);
}

async function seedInfractionCatalog() {
	console.log("Seeding traffic_violations_catalog...\n");

	const catalogPath = join(
		import.meta.dirname,
		"../../src/db/infracoes - Página1.csv",
	);

	const catalogRaw = await readFile(catalogPath, "utf-8");
	const catalog = parseCatalogCSV(catalogRaw);
	console.log(`  Loaded ${catalog.length} catalog rows from CSV`);

	const inserts = catalog.map((r) => ({
		law_code: r.law_code,
		canonical_description: r.canonical_description,
		known_variants: r.known_variants,
		category: r.category,
		differentiation: r.differentiation,
	}));

	console.log(`  ${inserts.length} rows to insert`);

	await db.execute(sql`TRUNCATE traffic_violations_catalog RESTART IDENTITY CASCADE`);

	const batchSize = 100;
	for (let i = 0; i < inserts.length; i += batchSize) {
		const batch = inserts.slice(i, i + batchSize);
		await db.execute(
			sql`INSERT INTO traffic_violations_catalog (law_code, canonical_description, known_variants, category, differentiation)
			    SELECT * FROM json_to_recordset(${JSON.stringify(batch)}::json)
			    AS x(law_code text, canonical_description text, known_variants text[], category text, differentiation text)`,
		);
	}

	console.log(`  Inserted ${inserts.length} rows`);

	console.log("\n  Updating traffic_violations.violation_id and description...");

	await db.execute(sql`UPDATE traffic_violations SET violation_id = NULL`);

	const result = await db.execute(sql`
		UPDATE traffic_violations tv SET
			violation_id = best.catalog_id,
			description = best.canonical_description
		FROM (
			SELECT DISTINCT ON (tv2.id)
				tv2.id as violation_row_id,
				tvc.id as catalog_id,
				tvc.canonical_description
			FROM traffic_violations tv2
			JOIN traffic_violations_catalog tvc
				ON tv2.description = tvc.canonical_description
				OR tv2.description = ANY(tvc.known_variants)
			ORDER BY
				tv2.id,
				CASE WHEN tv2.description = tvc.canonical_description THEN 0 ELSE 1 END,
				tvc.id
		) best
		WHERE tv.id = best.violation_row_id
	`);

	const updatedCount = "rowCount" in result ? result.rowCount : "?";
	console.log(`  Updated ${updatedCount} traffic_violations rows`);

	console.log("\nPipeline complete.\n");
}

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
