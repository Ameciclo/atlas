CREATE TABLE "geolocated_crashes" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp NOT NULL,
	"n_injured" integer DEFAULT 0 NOT NULL,
	"n_deaths" integer DEFAULT 0 NOT NULL,
	"coordinates" text NOT NULL,
	"complementary_data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
