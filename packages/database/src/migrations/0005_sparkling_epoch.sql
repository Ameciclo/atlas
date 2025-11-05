CREATE TABLE "ciclomapa_infra" (
	"id" serial PRIMARY KEY NOT NULL,
	"osm_id" text NOT NULL,
	"name" text,
	"infra_type" text NOT NULL,
	"coordinates" text NOT NULL,
	"geojson" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cities" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"state" text NOT NULL,
	"full_state" text NOT NULL,
	"rmr" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cyclist_infra_relation_cities" (
	"id" serial PRIMARY KEY NOT NULL,
	"relation_id" integer NOT NULL,
	"city_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cyclist_infra_relations" (
	"id" serial PRIMARY KEY NOT NULL,
	"osm_id" text,
	"pdc_ref" text,
	"pdc_typology" text,
	"name" text,
	"pdc_stretch" text,
	"pdc_cities" text,
	"pdc_notes" text,
	"notes" text,
	"pdc_km" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pdc_relation_ways" (
	"id" serial PRIMARY KEY NOT NULL,
	"osm_id" text NOT NULL,
	"relation_id" integer,
	"name" text,
	"geometry_type" text NOT NULL,
	"coordinates" text NOT NULL,
	"osm_properties" jsonb NOT NULL,
	"geojson" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cyclist_infra_relation_cities" ADD CONSTRAINT "cyclist_infra_relation_cities_relation_id_cyclist_infra_relations_id_fk" FOREIGN KEY ("relation_id") REFERENCES "public"."cyclist_infra_relations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cyclist_infra_relation_cities" ADD CONSTRAINT "cyclist_infra_relation_cities_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdc_relation_ways" ADD CONSTRAINT "pdc_relation_ways_relation_id_cyclist_infra_relations_id_fk" FOREIGN KEY ("relation_id") REFERENCES "public"."cyclist_infra_relations"("id") ON DELETE no action ON UPDATE no action;