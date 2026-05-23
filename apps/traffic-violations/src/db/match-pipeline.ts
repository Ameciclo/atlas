import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { db, ensureConnection } from "./index.js";
import {
  officialStreets,
  locationStreetMatches,
  trafficViolations,
} from "./schema.js";
import { normalizeLocation } from "../lib/street-normalizer.js";
import {
  matchExactName,
  matchLevenshtein,
  matchTrigram,
  disambiguateByNeighborhood,
  mapConfidence,
  type StreetRecord,
} from "../lib/street-matcher.js";
import { sql, isNull } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AddressData {
  codigo_logradouro: string;
  latitude: number;
  longitude: number;
  endereco_infracao: string;
  local_id: number;
}

interface VariantMapEntry {
  pattern: string;
  replacement: string;
  target_code: number | null;
  note: string;
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const MODE_APPLY = args.includes("--apply");
const MODE_DRY_RUN = args.includes("--dry-run") || !MODE_APPLY;
const FASE = (() => {
  const f = args.find((a) => a.startsWith("--fase="));
  if (f) {
    const parts = f.split("=");
    const n = parseInt(parts[1] ?? "", 10);
    if ([1, 2, 3].includes(n)) return n;
  }
  return 0; // 0 = all phases
})();

// ---------------------------------------------------------------------------
// Data loaders (file-based, no DB dependency for street names)
// ---------------------------------------------------------------------------

async function loadStreetsFromDB(): Promise<StreetRecord[]> {
  const rows = await db
    .select({
      code: officialStreets.code,
      nameConcatenated: officialStreets.name_concatenated,
      officialName: officialStreets.official_name,
      shortName: officialStreets.short_name,
      neighborhoodCode: officialStreets.neighborhood_code,
      neighborhoodName: officialStreets.neighborhood_name,
    })
    .from(officialStreets);
  return rows;
}

async function loadAddressCSV(): Promise<Map<number, AddressData>> {
  const basePath = join(import.meta.dirname, "../../src/db");
  const raw = await readFile(
    join(basePath, "enderecos_otimizado.csv"),
    "utf-8",
  );
  const lines = raw.trim().split("\n").slice(1);
  const lookup = new Map<number, AddressData>();

  for (const line of lines) {
    const values = line.split(",");
    if (values.length >= 5) {
      const local_id = Number(values[values.length - 1]) || 0;
      if (local_id > 0) {
        lookup.set(local_id, {
          codigo_logradouro: values[0] || "",
          latitude: Number(values[1]) || 0,
          longitude: Number(values[2]) || 0,
          endereco_infracao: values.slice(3, -1).join(","),
          local_id,
        });
      }
    }
  }
  return lookup;
}

async function loadLocationDict(): Promise<Map<number, string>> {
  const basePath = join(import.meta.dirname, "../../src/db");
  const raw = await readFile(
    join(basePath, "dict_locais_v2.json"),
    "utf-8",
  );
  const dict: Record<string, number> = JSON.parse(raw);
  const lookup = new Map<number, string>();
  for (const [desc, id] of Object.entries(dict)) lookup.set(id, desc);
  return lookup;
}

async function loadVariantDictionary(): Promise<VariantMapEntry[]> {
  const basePath = join(import.meta.dirname, "../../src/db");
  const path = join(basePath, "dict_variantes_ruas.json");
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function applyVariantDictionary(
  streetName: string,
  dict: VariantMapEntry[],
): string {
  let result = streetName;
  for (const entry of dict) {
    const regex = new RegExp(entry.pattern, "gi");
    if (regex.test(result)) {
      result = entry.replacement;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Phase 1: Register existing CSV codes
// ---------------------------------------------------------------------------

async function phase1_registerExisting(
  addressLookup: Map<number, AddressData>,
  locationDict: Map<number, string>,
  existingMatchIds: Set<number>,
  streetCodes: Set<number>,
): Promise<{ registered: number; skipped: number }> {
  const rows: Array<{
    location_id: number;
    location_description: string;
    matched_street_code: number;
    match_method: string;
    match_confidence: number;
    validation_status: string;
    needs_validation: boolean;
  }> = [];

  for (const [locId, addr] of addressLookup) {
    if (existingMatchIds.has(locId)) continue;

    const code = Number(addr.codigo_logradouro);
    if (!Number.isNaN(code) && code > 0 && streetCodes.has(code)) {
      const desc = locationDict.get(locId) || addr.endereco_infracao;
      rows.push({
        location_id: locId,
        location_description: desc,
        matched_street_code: code,
        match_method: "exact_code",
        match_confidence: 1.0,
        validation_status: "auto_matched",
        needs_validation: false,
      });
    }
  }

  if (MODE_DRY_RUN) {
    console.log(
      `   [DRY-RUN] Would register ${rows.length} locations with exact CSV code`,
    );
    return { registered: rows.length, skipped: 0 };
  }

  const batchSize = 500;
  let registered = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await db
      .insert(locationStreetMatches)
      .values(batch as any)
      .onConflictDoNothing();
    registered += batch.length;
  }

  console.log(`   ✓ Registered ${registered} locations with exact_code`);
  return { registered, skipped: 0 };
}

// ---------------------------------------------------------------------------
// Phase 2: Text match for orphan locations (no CSV code)
// ---------------------------------------------------------------------------

interface Phase2Row {
  location_id: number;
  location_description: string;
  extracted_street_name: string | null;
  extracted_street_type: string | null;
  semaphore_number: string | null;
  matched_street_code: number | null;
  match_method: string | null;
  match_confidence: number;
  alternative_candidates: unknown;
  needs_validation: boolean;
  validation_status: string | null;
  normalized_data: unknown;
}

function matchSingleLocation(
  locId: number,
  description: string,
  streets: StreetRecord[],
  variantDict: VariantMapEntry[],
): Phase2Row | null {
  const normalized = normalizeLocation(description);
  const fullStreet = normalized.fullStreet || normalized.streetName;
  if (!fullStreet || fullStreet.length < 3) return null;

  // Apply variant dictionary to the extracted street name
  const transformedName = applyVariantDictionary(fullStreet, variantDict);

  // --- Pass 1: Exact normalized match (with variant dictionary applied) ---
  let candidates = matchExactName(transformedName, streets);
  if (candidates.length > 1) {
    candidates = disambiguateByNeighborhood(candidates, null);
  }

  // --- Pass 2: Exact normalized match on original name ---
  if (candidates.length === 0 && transformedName !== fullStreet) {
    candidates = matchExactName(fullStreet, streets);
    if (candidates.length > 1) {
      candidates = disambiguateByNeighborhood(candidates, null);
    }
  }

  // --- Pass 3: Fuzzy Levenshtein ---
  if (candidates.length === 0) {
    candidates = matchLevenshtein(transformedName, streets, 0.85);
  }

  // --- Pass 4: Fuzzy trigram ---
  if (candidates.length === 0) {
    candidates = matchTrigram(transformedName, streets, 0.35);
  }

  const matched = candidates.length > 0 && candidates[0] !== undefined;
  const best = matched ? candidates[0] : null;
  const method = best?.method ?? null;
  const score = best?.score ?? 0;
  const confidence = method ? mapConfidence(score, method) : 0;
  const needsValidation = confidence > 0 && confidence < 0.85;

  return {
    location_id: locId,
    location_description: description,
    extracted_street_name: normalized.streetName,
    extracted_street_type: normalized.streetType,
    semaphore_number: normalized.semaphoreNumber,
    matched_street_code: best?.street.code ?? null,
    match_method: method,
    match_confidence: confidence,
    alternative_candidates: candidates.slice(0, 5).map((c) => ({
      street_code: c.street.code,
      official_name: c.street.officialName,
      score: Math.round(c.score * 1000) / 1000,
      method: c.method,
    })),
    needs_validation: needsValidation,
    validation_status: best ? "auto_matched" : null,
    normalized_data: {
      fullStreet: normalized.fullStreet,
      transformedName,
      semaphoreNumber: normalized.semaphoreNumber,
      direction: normalized.direction,
    },
  };
}

async function phase2_matchOrphans(
  locationDict: Map<number, string>,
  addressLookup: Map<number, AddressData>,
  existingMatchIds: Set<number>,
  streets: StreetRecord[],
  streetCodes: Set<number>,
): Promise<{ matched: number; unmatched: number; needsValidation: number }> {
  const variantDict = await loadVariantDictionary();
  const rows: Phase2Row[] = [];
  let matched = 0;
  let needsValidation = 0;

  for (const [locId, description] of locationDict) {
    // Skip already matched in DB
    if (existingMatchIds.has(locId)) continue;

    // Skip locations that already have a CSV code (covered by Phase 1)
    const addr = addressLookup.get(locId);
    const csvCode = addr?.codigo_logradouro
      ? Number(addr.codigo_logradouro)
      : NaN;
    if (!Number.isNaN(csvCode) && csvCode > 0 && streetCodes.has(csvCode)) {
      continue;
    }

    const result = matchSingleLocation(
      locId,
      description,
      streets,
      variantDict,
    );
    if (!result) continue;

    if (result.matched_street_code) matched++;
    if (result.needs_validation) needsValidation++;
    rows.push(result);
  }

  console.log(
    `   🔍 ${rows.length} orphan locations to text-match`,
  );

  if (MODE_DRY_RUN) {
    console.log(
      `   [DRY-RUN] Would insert ${rows.length} results (${matched} matched, ${needsValidation} need validation)`,
    );
    return { matched, unmatched: rows.length - matched, needsValidation };
  }

  const batchSize = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await db
      .insert(locationStreetMatches)
      .values(batch as any)
      .onConflictDoNothing();
    inserted += batch.length;
  }

  console.log(
    `   ✓ Inserted ${inserted} results (${matched} matched, ${needsValidation} need validation)`,
  );
  return {
    matched,
    unmatched: rows.length - matched,
    needsValidation,
  };
}

// ---------------------------------------------------------------------------
// Phase 3: Apply matches to traffic_violations (--apply only)
// ---------------------------------------------------------------------------

async function phase3_applyMatches(): Promise<{ updated: number }> {
  // Only update violations that have a match AND currently have street_code = NULL
  // This ensures we NEVER overwrite existing data.

  const matches = await db
    .select({
      location_id: locationStreetMatches.location_id,
      street_code: locationStreetMatches.matched_street_code,
    })
    .from(locationStreetMatches)
    .where(
      sql`${locationStreetMatches.matched_street_code} IS NOT NULL`,
    );

  if (matches.length === 0) {
    console.log("   No matches to apply");
    return { updated: 0 };
  }

  // Build lookup: location_id -> street_code
  const codeByLocation = new Map<number, number>();
  for (const m of matches) {
    if (m.street_code) codeByLocation.set(m.location_id, m.street_code);
  }

  // Group location_ids in batches for UPDATE
  const locationIds = [...codeByLocation.keys()];
  const batchSize = 500;
  let totalUpdated = 0;

  for (let i = 0; i < locationIds.length; i += batchSize) {
    const batch = locationIds.slice(i, i + batchSize);

    // For each location_id, update all violations with that location_id
    // AND street_code IS NULL
    for (const locId of batch) {
      const streetCode = codeByLocation.get(locId);
      if (!streetCode) continue;

      if (MODE_DRY_RUN) {
        // Count how many would be updated
        const countResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(trafficViolations)
          .where(
            sql`${trafficViolations.location_id} = ${locId} AND ${trafficViolations.street_code} IS NULL`,
          );
        totalUpdated += Number(countResult[0]?.count ?? 0);
      } else {
        const result = await db
          .update(trafficViolations)
          .set({
            street_code: streetCode,
            updated_at: new Date(),
          })
          .where(
            sql`${trafficViolations.location_id} = ${locId} AND ${trafficViolations.street_code} IS NULL`,
          );
        // result is the update result; drizzle returns an array
        totalUpdated += Array.isArray(result) ? result.length : 0;
      }
    }
  }

  if (MODE_DRY_RUN) {
    console.log(
      `   [DRY-RUN] Would update ${totalUpdated} violations (street_code IS NULL only)`,
    );
  } else {
    console.log(
      `   ✓ Updated ${totalUpdated} violations (street_code IS NULL only)`,
    );
  }

  return { updated: totalUpdated };
}

// ---------------------------------------------------------------------------
// Stats / summary
// ---------------------------------------------------------------------------

async function printStats() {
  const [total] = await db
    .select({ count: sql<number>`count(*)` })
    .from(locationStreetMatches);

  const [matched] = await db
    .select({ count: sql<number>`count(*)` })
    .from(locationStreetMatches)
    .where(
      sql`${locationStreetMatches.matched_street_code} IS NOT NULL`,
    );

  const [pending] = await db
    .select({ count: sql<number>`count(*)` })
    .from(locationStreetMatches)
    .where(sql`${locationStreetMatches.needs_validation} = true`);

  const byMethod = await db
    .select({
      method: locationStreetMatches.match_method,
      count: sql<number>`count(*)`,
    })
    .from(locationStreetMatches)
    .where(
      sql`${locationStreetMatches.match_method} IS NOT NULL`,
    )
    .groupBy(locationStreetMatches.match_method)
    .orderBy(sql`count(*) DESC`);

  // Count violations still missing street_code
  const [orphanViolations] = await db
    .select({ count: sql<number>`count(*)` })
    .from(trafficViolations)
    .where(isNull(trafficViolations.street_code));

  console.log("\n📈 Current state of location_street_matches:");
  console.log(`   Total rows:            ${total?.count ?? 0}`);
  console.log(`   With street matched:   ${matched?.count ?? 0}`);
  console.log(`   Needs validation:      ${pending?.count ?? 0}`);
  console.log(`   Violations still NULL:  ${orphanViolations?.count ?? 0}`);
  console.log("\n   By method:");
  for (const row of byMethod) {
    console.log(`     ${row.method}: ${row.count}`);
  }
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

export async function runMatchPipeline() {
  await ensureConnection();

  const modeLabel = MODE_APPLY ? "APPLY" : "DRY-RUN";
  console.log(`🚀 Street matching pipeline [${modeLabel}]`);
  if (FASE) console.log(`   Fase: ${FASE}`);
  console.log();

  // Load data
  console.log("📊 Loading data...");
  const streets = await loadStreetsFromDB();
  const locationDict = await loadLocationDict();
  const addressLookup = await loadAddressCSV();
  const streetCodes = new Set(streets.map((s) => s.code));

  // Existing matches in DB
  const existing = await db
    .select({ location_id: locationStreetMatches.location_id })
    .from(locationStreetMatches);
  const existingMatchIds = new Set(existing.map((r) => r.location_id));

  console.log(`   ✓ ${streets.length} streets loaded`);
  console.log(`   ✓ ${locationDict.size} locations loaded`);
  console.log(`   ✓ ${addressLookup.size} CSV address records`);
  console.log(
    `   ✓ ${existingMatchIds.size} already in location_street_matches\n`,
  );

  // -----------------------------------------------------------------------
  // Phase 1
  // -----------------------------------------------------------------------
  if (FASE === 0 || FASE === 1) {
    console.log("📋 Phase 1: Register existing CSV codes...");
    await phase1_registerExisting(
      addressLookup,
      locationDict,
      existingMatchIds,
      streetCodes,
    );
    // Refresh existing after Phase 1 inserts
    const updated = await db
      .select({ location_id: locationStreetMatches.location_id })
      .from(locationStreetMatches);
    for (const r of updated) existingMatchIds.add(r.location_id);
    console.log();
  }

  // -----------------------------------------------------------------------
  // Phase 2
  // -----------------------------------------------------------------------
  if (FASE === 0 || FASE === 2) {
    console.log("📋 Phase 2: Text match for orphan locations...");
    await phase2_matchOrphans(
      locationDict,
      addressLookup,
      existingMatchIds,
      streets,
      streetCodes,
    );
    console.log();
  }

  // -----------------------------------------------------------------------
  // Phase 3
  // -----------------------------------------------------------------------
  if (FASE === 0 || FASE === 3) {
    if (!MODE_APPLY) {
      console.log(
        "📋 Phase 3: Skipped (use --apply to write to traffic_violations)\n",
      );
    } else {
      console.log(
        "📋 Phase 3: Applying matches to traffic_violations (street_code IS NULL only)...",
      );
      await phase3_applyMatches();
      console.log();
    }
  }

  // Stats
  await printStats();
  console.log("\n✅ Pipeline done.\n");
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  runMatchPipeline()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Pipeline failed:", err);
      process.exit(1);
    });
}
