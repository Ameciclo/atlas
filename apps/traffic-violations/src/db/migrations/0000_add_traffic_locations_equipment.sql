-- Migration: Add traffic_locations, traffic_equipment tables and extend location_street_matches
-- Replaces dict_locais_v2.json with database-backed location registry

CREATE TABLE IF NOT EXISTS "traffic_locations" (
    "id" SERIAL PRIMARY KEY,
    "location_id" INTEGER NOT NULL UNIQUE,
    "raw_description" TEXT NOT NULL,
    "extracted_street" TEXT,
    "street_type" TEXT,
    "semaphore_number" TEXT,
    "address_number" TEXT,
    "reference_point" TEXT,
    "direction" TEXT,
    "is_new" BOOLEAN DEFAULT false,
    "source_year" INTEGER,
    "created_at" TIMESTAMPTZ DEFAULT now() NOT NULL,
    "updated_at" TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_tl_location_id" ON "traffic_locations" ("location_id");
CREATE INDEX IF NOT EXISTS "idx_tl_is_new" ON "traffic_locations" ("is_new");
CREATE INDEX IF NOT EXISTS "idx_tl_semaphore" ON "traffic_locations" ("semaphore_number");

CREATE TABLE IF NOT EXISTS "traffic_equipment" (
    "id" SERIAL PRIMARY KEY,
    "equipment_type" TEXT NOT NULL,
    "identification" TEXT,
    "local_instalacao" TEXT,
    "latitude" TEXT,
    "longitude" TEXT,
    "sentido" TEXT,
    "street_code" INTEGER REFERENCES "street_codes" ("code"),
    "extra_data" JSONB,
    "source_file" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_te_type" ON "traffic_equipment" ("equipment_type");
CREATE INDEX IF NOT EXISTS "idx_te_identification" ON "traffic_equipment" ("identification");
CREATE INDEX IF NOT EXISTS "idx_te_street_code" ON "traffic_equipment" ("street_code");

ALTER TABLE "location_street_matches"
    ADD COLUMN IF NOT EXISTS "is_new" BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS "created_by" TEXT;

CREATE INDEX IF NOT EXISTS "idx_lsm_is_new" ON "location_street_matches" ("is_new");
