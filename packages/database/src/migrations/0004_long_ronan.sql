CREATE TABLE "bicycle_rack_cities" (
	"id" serial PRIMARY KEY NOT NULL,
	"osm_id" text NOT NULL,
	"city" text NOT NULL,
	"state" text DEFAULT 'PE',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bicycle_rack_cities_osm_id_unique" UNIQUE("osm_id")
);
