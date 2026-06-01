-- Migration: Create traffic_locations table
-- Replaces dict_locais_v2.json with database-backed location registry

CREATE TABLE IF NOT EXISTS "traffic_locations" (
    "id" SERIAL PRIMARY KEY,
    "location_id" INTEGER NOT NULL UNIQUE,
    "raw_description" TEXT NOT NULL,
    "extracted_street" TEXT,
    "street_type" TEXT,
    "matched_street_code" INTEGER REFERENCES "pcr_streets" ("clogra_codi"),
    "semaphore_number" TEXT,
    "address_number" TEXT,
    "equipment_address" TEXT,
    "equipment_neighborhood" TEXT,
    "latitude" TEXT,
    "longitude" TEXT,
    "reference_point" TEXT,
    "direction" TEXT,
    "match_method" TEXT,
    "match_confidence" NUMERIC,
    "alternative_candidates" JSONB,
    "validation_status" TEXT,
    "normalized_data" JSONB,
    "confidence" TEXT DEFAULT 'low',
    "needs_review" BOOLEAN DEFAULT false,
    "is_new" BOOLEAN DEFAULT false,
    "source_year" INTEGER,
    "created_at" TIMESTAMPTZ DEFAULT now() NOT NULL,
    "updated_at" TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_tl_location_id" ON "traffic_locations" ("location_id");
CREATE INDEX IF NOT EXISTS "idx_tl_semaphore" ON "traffic_locations" ("semaphore_number");
CREATE INDEX IF NOT EXISTS "idx_tl_matched_street" ON "traffic_locations" ("matched_street_code");
