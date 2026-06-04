-- Drop existing foreign key constraints referencing official_streets
ALTER TABLE "traffic_violations" DROP CONSTRAINT IF EXISTS "traffic_violations_street_code_official_streets_code_fk";
ALTER TABLE "location_street_matches" DROP CONSTRAINT IF EXISTS "location_street_matches_matched_street_code_fkey";

-- Create new lean street_codes table (unique code per street, derived from pcr_streets)
CREATE TABLE "street_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" integer NOT NULL,
	"name_concatenated" text NOT NULL,
	"official_name" text NOT NULL,
	"short_name" text NOT NULL,
	"pavement_code" text,
	"pavement_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "street_codes_code_unique" UNIQUE("code")
);

-- Populate from pcr_streets (one row per unique street code)
INSERT INTO "street_codes" ("code", "name_concatenated", "official_name", "short_name", "pavement_code", "pavement_description")
SELECT DISTINCT ON ("clogra_codi")
	"clogra_codi",
	"nlogra_conc",
	"nlgpav_ofic",
	"nlgpav_resu",
	"flgpav_indp",
	"indpav"
FROM "pcr_streets";

-- Also include codes from old official_streets that are NOT in pcr_streets yet (orphan codes referenced by traffic_violations or location_street_matches)
INSERT INTO "street_codes" ("code", "name_concatenated", "official_name", "short_name", "pavement_code", "pavement_description")
SELECT os."code",
       os."name_concatenated",
       os."official_name",
       os."short_name",
       os."pavement_code",
       os."pavement_description"
FROM "official_streets" os
WHERE os."code" NOT IN (SELECT "code" FROM "street_codes")
ON CONFLICT ("code") DO NOTHING;

-- Drop the old table (CASCADE handles any remaining dependencies)
DROP TABLE IF EXISTS "official_streets" CASCADE;

-- Re-create foreign keys referencing new table
ALTER TABLE "traffic_violations" ADD CONSTRAINT "traffic_violations_street_code_street_codes_code_fk" FOREIGN KEY ("street_code") REFERENCES "public"."street_codes"("code") ON DELETE no action ON UPDATE no action;
ALTER TABLE "location_street_matches" ADD CONSTRAINT "location_street_matches_matched_street_code_street_codes_code_fk" FOREIGN KEY ("matched_street_code") REFERENCES "public"."street_codes"("code") ON DELETE no action ON UPDATE no action;
