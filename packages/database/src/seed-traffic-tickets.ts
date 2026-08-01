import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import type { DatabaseConfig } from "./connection.js";
import { closeDatabase, createConnectedDatabase } from "./connection.js";
import * as trafficTicketsSchema from "./schemas/traffic-tickets/index.js";

interface CatalogEntry {
	law_code: string;
	canonical_description: string;
	known_variants: string[];
	category: string;
}

interface CatalogEntryWithId extends CatalogEntry {
	id: number;
}

interface CompiledRow {
	violation_date: string;
	agent_id: number;
	violation_dict_id: number;
	location_id: number;
	cttu_code: string;
}

/**
 * Seed traffic tickets from compiled TSV (v3 format, 5 numeric columns).
 * Catalog and location data are resolved from database tables.
 */
export async function seedTrafficTickets(config: DatabaseConfig = {}) {
	const db = await createConnectedDatabase(config);

	try {
		console.log("🌱 Starting traffic violations seed...");

		const basePath = join(import.meta.dirname, "../seed-data/traffic-tickets");
		const dataPath = join(basePath, "traffic-tickets-compiled.tsv");

		// --- Catalog: insert if cold start, then build origId → catalog map ---
		console.log("\n📚 Loading violation catalog...");

		// Always load catalog + violation descriptions for the lookup map
		const catalogPath = join(basePath, "catalog_categories.json");
		const catalogRaw = await readFile(catalogPath, "utf-8");
		const catalog: CatalogEntry[] = JSON.parse(catalogRaw);

		const vdRaw = await readFile(
			join(basePath, "violation-descriptions.json"),
			"utf-8",
		);
		const vd: Record<string, number> = JSON.parse(vdRaw);

		// Build origId → catalog index mapping
		const origToCatIdx: Record<number, number> = {};
		for (let idx = 0; idx < catalog.length; idx++) {
			for (const variant of catalog[idx]!.known_variants) {
				for (const [key, origId] of Object.entries(vd)) {
					if (key.includes(variant)) {
						origToCatIdx[origId as number] = idx;
					}
				}
			}
		}

		// Build deterministic catalog ID mapping (always needed for origId → catalog.id)
		const idxToIds: Record<number, number[]> = {};
		for (const [origId, catIdx] of Object.entries(origToCatIdx)) {
			const ci = catIdx as number;
			if (!idxToIds[ci]) idxToIds[ci] = [];
			idxToIds[ci].push(Number(origId));
		}
		const catIdMap: Record<number, number> = {};
		for (let idx = 0; idx < catalog.length; idx++) {
			const ids = idxToIds[idx] || [];
			catIdMap[idx] = ids.length > 0 ? Math.min(...ids) : idx + 1;
		}

		// --- Truncate everything before inserting ---
		await db.execute(
			sql`TRUNCATE traffic_tickets_catalog, traffic_tickets, traffic_tickets_locations RESTART IDENTITY CASCADE`,
		);

		// Catalog: cold start every run (truncated above)
		console.log(`  Cold start: inserting ${catalog.length} catalog entries`);

		const catalogInserts: CatalogEntryWithId[] = catalog.map((r, idx) => ({
			id: catIdMap[idx]!,
			law_code: r.law_code,
			canonical_description: r.canonical_description,
			known_variants: r.known_variants,
			category: r.category,
		}));
		await db.execute(sql`
			INSERT INTO traffic_tickets_catalog (id, law_code, canonical_description, known_variants, category)
			SELECT * FROM json_to_recordset(${JSON.stringify(catalogInserts)}::json)
			AS x(id int, law_code text, canonical_description text, known_variants text[], category text)
			ON CONFLICT (id) DO NOTHING
		`);
		const maxId = Math.max(...catalogInserts.map((c) => c.id));
		await db.execute(sql`
			SELECT setval('traffic_tickets_catalog_id_seq', ${maxId}, true)
		`);

		// --- Locations ---
		console.log("\n📍 Loading location descriptions...");

		const locationPath = join(basePath, "location-descriptions.tsv");
		const tsvData = await readFile(locationPath, "utf-8");
		const lines = tsvData.trim().split("\n");
		const dataLines = lines.slice(1); // skip header
		const expectedCount = dataLines.length;
		console.log(`  Inserting ${expectedCount} locations`);

		let locationsCreated = 0;
		const locationBatchSize = 1000;

		let validLineCount = 0;

		for (let i = 0; i < dataLines.length; i += locationBatchSize) {
			const batch = dataLines.slice(i, i + locationBatchSize);
			const locationsToInsert = [];

			for (const line of batch) {
				const values = line.split("\t");

				if (values.length < 9) {
					// Pad with empty strings for missing trailing fields
					while (values.length < 9) values.push("");
				}

				locationsToInsert.push({
					location_id: Number(values[0]) || 0,
					raw_description: values[1] || "",
					extracted_street: values[2] || null,
					street_type: values[3] || null,
					street_code: values[4] ? Number(values[4]) : null,
					semaphore_number: values[5] || null,
					address_number: values[6] || null,
					direction: values[7] || null,
					reference_point: values[8] || null,
				});
			}

			validLineCount += locationsToInsert.length;

			if (locationsToInsert.length > 0) {
				try {
					await db
						.insert(trafficTicketsSchema.trafficTicketsLocations)
						.values(locationsToInsert)
						.onConflictDoNothing();
				} catch (insertError) {
					console.warn(
						`  ⚠ Location batch ${Math.floor(i / locationBatchSize) + 1} failed, retrying individually...`,
					);
					let ok = 0;
					let fail = 0;
					for (const row of locationsToInsert) {
						try {
							await db
								.insert(trafficTicketsSchema.trafficTicketsLocations)
								.values(row)
								.onConflictDoNothing();
							ok++;
						} catch (rowError) {
							console.error(
								`    ❌ location_id=${row.location_id}:`,
								(rowError as any).detail || rowError,
							);
							fail++;
						}
					}
					if (fail > 0) {
						throw new Error(
							`${fail} location rows failed (${ok} succeeded) in batch ${Math.floor(i / locationBatchSize) + 1}`,
						);
					}
				}
				locationsCreated += locationsToInsert.length;
				const batchNum = Math.floor(i / locationBatchSize) + 1;
				if (batchNum % 100 === 0) {
					const totalBatches = Math.ceil(dataLines.length / locationBatchSize);
					console.log(
						`  ↪ Locations: batch ${batchNum}/${totalBatches} (${((batchNum / totalBatches) * 100).toFixed(0)}%)`,
					);
				}
			}
		}

		// Verify all locations were inserted
		const actualLocationCount = Number(
			(
				await db.execute(
					sql`SELECT COUNT(*)::int as cnt FROM traffic_tickets_locations`,
				)
			).rows[0]?.cnt ?? 0,
		);
		if (actualLocationCount !== validLineCount) {
			// Find gaps using window function (works with non-sequential IDs too)
			const gaps = await db.execute(sql`
				WITH gaps AS (
					SELECT location_id, LAG(location_id) OVER (ORDER BY location_id) AS prev_id
					FROM traffic_tickets_locations
				)
				SELECT (prev_id + 1) AS missing_id
				FROM gaps
				WHERE location_id - prev_id > 1
				ORDER BY prev_id
				LIMIT 10
			`);
			const missingIds = gaps.rows.map((r: any) => Number(r.missing_id));

			// Also check if last expected ID is missing
			const maxId = Number(
				(
					await db.execute(
						sql`SELECT MAX(location_id)::int as max_id FROM traffic_tickets_locations`,
					)
				).rows[0]?.max_id ?? 0,
			);
			// Find max expected location_id from the parsed data
			let maxExpectedId = 0;
			for (const line of dataLines) {
				const val = Number(line.split("\t")[0]);
				if (val > maxExpectedId) maxExpectedId = val;
			}
			for (
				let id = maxId + 1;
				id <= maxExpectedId && missingIds.length < 10;
				id++
			) {
				missingIds.push(id);
			}

			throw new Error(
				`Location count mismatch: expected ${validLineCount}, got ${actualLocationCount}. Missing IDs: ${missingIds.join(", ")}`,
			);
		}
		console.log(`  ✓ ${actualLocationCount} locations`);

		const ticketsTsv = await readFile(dataPath, "utf-8");
		const ticketLines = ticketsTsv.trim().split("\n");
		const headers = ticketLines[0]?.split("\t") || [];
		console.log(`\n📊 TSV columns: ${headers.join(", ")}`);
		const ticketDataLines = ticketLines.slice(1);
		console.log(`  Found ${ticketDataLines.length} violations to import`);

		let violationsCreated = 0;
		let unmatchedCatalog = 0;
		const batchSize = 1000;

		for (let i = 0; i < ticketDataLines.length; i += batchSize) {
			const batch = ticketDataLines.slice(i, i + batchSize);
			const violationsToInsert = [];

			for (const line of batch) {
				const values = line.split("\t");
				if (values.length < 5) continue;

				const row: CompiledRow = {
					violation_date: values[0] || "",
					agent_id: Number(values[1]) || 0,
					violation_dict_id: Number(values[2]) || 0,
					location_id: Number(values[3]) || 0,
					cttu_code: values[4] || "",
				};

				// ETL generates cat_id = 1-indexed catalog array index.
				// catIdMap maps array index → catalog DB id (cold start generated).
				const catIdx = row.violation_dict_id - 1;
				const violationId = catIdMap[catIdx];
				if (violationId === undefined) {
					unmatchedCatalog++;
					continue;
				}

				violationsToInsert.push({
					violation_date: new Date(row.violation_date),
					agent_id: row.agent_id,
					location_id: row.location_id,
					cttu_code: row.cttu_code,
					violation_id: violationId,
				});
			}

			if (violationsToInsert.length > 0) {
				const batchNum = Math.floor(i / batchSize) + 1;
				try {
					await db
						.insert(trafficTicketsSchema.trafficTickets)
						.values(violationsToInsert);
				} catch (insertError) {
					console.warn(
						`  ⚠ Batch ${batchNum} insert failed, retrying individually...`,
					);
					let ok = 0;
					let fail = 0;
					for (const row of violationsToInsert) {
						try {
							await db.insert(trafficTicketsSchema.trafficTickets).values(row);
							ok++;
						} catch (rowError) {
							console.error(
								`    ❌ Violation date=${row.violation_date} location_id=${row.location_id} violation_id=${row.violation_id}:`,
								(rowError as any).detail || rowError,
							);
							fail++;
						}
					}
					console.log(
						`    → ${ok} inserted, ${fail} failed in batch ${batchNum}`,
					);
					if (fail > 0) {
						throw new Error(
							`${fail} tickets failed to insert in batch ${batchNum}`,
						);
					}
				}
				violationsCreated += violationsToInsert.length;
				if (batchNum % 100 === 0) {
					const totalBatches = Math.ceil(ticketDataLines.length / batchSize);
					console.log(
						`  ↪ Violations: batch ${batchNum}/${totalBatches} (${((batchNum / totalBatches) * 100).toFixed(0)}%)`,
					);
				}
			}
		}

		// Verify ticket count matches expected
		const actualTicketCount = Number(
			(await db.execute(sql`SELECT COUNT(*)::int as cnt FROM traffic_tickets`))
				.rows[0]?.cnt ?? 0,
		);
		if (actualTicketCount !== violationsCreated) {
			console.warn(
				`  ⚠ Ticket count mismatch: tracked ${violationsCreated}, DB has ${actualTicketCount}`,
			);
		}

		console.log("\n✅ Seed completed successfully!");
		console.log(`   🚨 Violations: ${actualTicketCount}`);
		if (unmatchedCatalog > 0)
			console.log(`   ❓ Unmatched catalog: ${unmatchedCatalog}`);
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
	seedTrafficTickets().catch((error) => {
		console.error("Seed failed:", error);
		process.exit(1);
	});
}
