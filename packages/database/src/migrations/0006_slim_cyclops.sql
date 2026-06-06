-- Add city_id column to ciclomapa_infra for per-city aggregation
ALTER TABLE "ciclomapa_infra" ADD COLUMN "city_id" integer REFERENCES "cities"("id");
