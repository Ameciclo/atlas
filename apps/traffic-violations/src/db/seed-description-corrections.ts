import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { db } from "./index.js";
import { descriptionCorrections, trafficViolations } from "./schema.js";

// ============================================================================
// Phase 1: Seed — read CSV and populate description_corrections table
// ============================================================================

interface CsvRow {
	violation_code: string;
	law_code: string;
	description: string;
	description_corrected: string;
}

function parseCSV(raw: string): CsvRow[] {
	const lines = raw.trim().split("\n");
	return lines.slice(1).map((line) => {
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
			violation_code: (values[0] || "").replace(/^"|"$/g, ""),
			law_code: (values[1] || "").replace(/^"|"$/g, ""),
			description: (values[2] || "").replace(/^"|"$/g, ""),
			description_corrected: (values[3] || "").replace(/^"|"$/g, ""),
		};
	});
}

// ============================================================================
// Phase 2: Apply — run pending corrections against traffic_violations
// ============================================================================

async function apply() {
	const pending = await db
		.select({
			id: descriptionCorrections.id,
			violation_code: descriptionCorrections.violation_code,
			original: descriptionCorrections.original_description,
			corrected: descriptionCorrections.corrected_description,
		})
		.from(descriptionCorrections)
		.where(eq(descriptionCorrections.applied, false));

	if (pending.length === 0) {
		console.log("   No pending corrections to apply.\n");
		return;
	}

	console.log(`   Applying ${pending.length} pending corrections...`);
	let updated = 0;

	for (const row of pending) {
		const result = await db
			.update(trafficViolations)
			.set({ description: row.corrected })
			.where(
				sql`${trafficViolations.violation_code} = ${row.violation_code} AND ${trafficViolations.description} = ${row.original}`,
			);

		await db
			.update(descriptionCorrections)
			.set({ applied: true })
			.where(eq(descriptionCorrections.id, row.id));

		updated++;
	}

	console.log(`   ✓ Applied ${updated} corrections\n`);
}

// ============================================================================
// Main
// ============================================================================

async function seedAndApply() {
	console.log("🌱 Seeding description_corrections...");

	// Ensure table exists
	await db.execute(sql`
		CREATE TABLE IF NOT EXISTS description_corrections (
			id SERIAL PRIMARY KEY,
			violation_code TEXT NOT NULL,
			original_description TEXT NOT NULL,
			corrected_description TEXT NOT NULL,
			applied BOOLEAN DEFAULT false,
			created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
			UNIQUE (violation_code, original_description)
		)
	`);

	// Read CSV
	const path = join(
		import.meta.dirname,
		"../../src/db/descricoes_infracoes_corrigidas.csv",
	);
	const raw = await readFile(path, "utf-8");
	const rows = parseCSV(raw);

	// Filter only rows that actually have a correction (original != corrected)
	const corrections = rows.filter((r) => r.description !== r.description_corrected);
	console.log(`   ${rows.length} total rows in CSV`);
	console.log(`   ${corrections.length} actual corrections (original != corrected)`);

	// Insert into table (skip already existing via unique constraint)
	let inserted = 0;
	let skipped = 0;
	for (const row of corrections) {
		const existing = await db
			.select({ id: descriptionCorrections.id })
			.from(descriptionCorrections)
			.where(
				sql`${descriptionCorrections.violation_code} = ${row.violation_code} AND ${descriptionCorrections.original_description} = ${row.description}`,
			)
			.limit(1);

		if (existing.length === 0) {
			await db.insert(descriptionCorrections).values({
				violation_code: row.violation_code,
				original_description: row.description,
				corrected_description: row.description_corrected,
			});
			inserted++;
		} else {
			skipped++;
		}
	}
	console.log(`   ✓ Inserted ${inserted}, skipped ${skipped} (already exist)`);

	// Apply
	await apply();
}

export { seedAndApply };

// Self-execute when run directly
const currentFile = import.meta.url.replace("file://", "");
if (process.argv[1]?.endsWith(currentFile) || process.argv[1]?.endsWith("seed-description-corrections.ts") || process.argv[1]?.endsWith("seed-description-corrections.js")) {
	seedAndApply()
		.then(() => process.exit(0))
		.catch((err) => {
			console.error("Failed:", err);
			process.exit(1);
		});
}
