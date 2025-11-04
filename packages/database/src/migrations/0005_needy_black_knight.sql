CREATE TABLE "official_streets" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" integer NOT NULL,
	"name_concatenated" text NOT NULL,
	"official_name" text NOT NULL,
	"short_name" text NOT NULL,
	"pavement_code" text,
	"pavement_description" text,
	"transport_corridor" boolean DEFAULT false,
	"perimeter_road" boolean DEFAULT false,
	"neighborhood_code" integer,
	"neighborhood_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "official_streets_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "traffic_violations" (
	"id" serial PRIMARY KEY NOT NULL,
	"violation_date" timestamp with time zone NOT NULL,
	"agent_id" integer NOT NULL,
	"violation_type_id" integer NOT NULL,
	"location_id" integer NOT NULL,
	"violation_code" text NOT NULL,
	"law_code" text NOT NULL,
	"description" text NOT NULL,
	"location_description" text NOT NULL,
	"coordinates" text,
	"street_code" integer,
	"complementary_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "traffic_violations" ADD CONSTRAINT "traffic_violations_street_code_official_streets_code_fk" FOREIGN KEY ("street_code") REFERENCES "public"."official_streets"("code") ON DELETE no action ON UPDATE no action;