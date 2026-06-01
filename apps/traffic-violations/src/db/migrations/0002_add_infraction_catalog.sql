-- Migration: Add infraction_catalog table with known variants
-- Replaces violation_categories keyword-override approach with exact-match lookup

CREATE TABLE IF NOT EXISTS "infraction_catalog" (
    "id" SERIAL PRIMARY KEY,
    "violation_code" TEXT NOT NULL,
    "law_code" TEXT NOT NULL,
    "canonical_description" TEXT NOT NULL,
    "known_variants" TEXT[] NOT NULL DEFAULT '{}',
    "category" TEXT NOT NULL,
    "total_rows" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (violation_code, canonical_description)
);

CREATE INDEX IF NOT EXISTS "idx_ic_category" ON "infraction_catalog" ("category");
CREATE INDEX IF NOT EXISTS "idx_ic_violation_code" ON "infraction_catalog" ("violation_code");
CREATE INDEX IF NOT EXISTS "idx_ic_variants" ON "infraction_catalog" USING gin ("known_variants");
