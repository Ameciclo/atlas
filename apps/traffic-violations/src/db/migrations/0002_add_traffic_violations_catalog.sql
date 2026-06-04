-- Migration: Add traffic_violations_catalog table with known variants
-- Replaces violation_categories keyword-override approach with exact-match lookup

CREATE TABLE IF NOT EXISTS "traffic_violations_catalog" (
    "id" SERIAL PRIMARY KEY,
    "cttu_code" TEXT NOT NULL,
    "law_code" TEXT NOT NULL,
    "canonical_description" TEXT NOT NULL,
    "known_variants" TEXT[] NOT NULL DEFAULT '{}',
    "category" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (cttu_code, canonical_description)
);

CREATE INDEX IF NOT EXISTS "idx_ic_category" ON "traffic_violations_catalog" ("category");
CREATE INDEX IF NOT EXISTS "idx_ic_cttu_code" ON "traffic_violations_catalog" ("cttu_code");
CREATE INDEX IF NOT EXISTS "idx_ic_variants" ON "traffic_violations_catalog" USING gin ("known_variants");
