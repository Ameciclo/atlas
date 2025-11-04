CREATE TYPE "public"."direction" AS ENUM('north', 'east', 'south', 'west');--> statement-breakpoint
CREATE TABLE "bicycle_rack_cities" (
	"id" serial PRIMARY KEY NOT NULL,
	"osm_id" text NOT NULL,
	"city" text NOT NULL,
	"state" text DEFAULT 'PE',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bicycle_rack_cities_osm_id_unique" UNIQUE("osm_id")
);
--> statement-breakpoint
CREATE TABLE "bicycle_racks" (
	"id" serial PRIMARY KEY NOT NULL,
	"osm_id" text,
	"osm_type" text,
	"coordinates" text,
	"name" text,
	"description" text,
	"amenity" text DEFAULT 'bicycle_parking',
	"bicycle_parking" text,
	"capacity" text,
	"access" text,
	"covered" text,
	"fee" text,
	"supervised" text,
	"lit" text,
	"operator" text,
	"operator_type" text,
	"building" text,
	"level" text,
	"surface" text,
	"addr_city" text,
	"addr_street" text,
	"addr_housenumber" text,
	"addr_suburb" text,
	"addr_postcode" text,
	"opening_hours" text,
	"payment_none" text,
	"ref" text,
	"source" text,
	"source_date" text,
	"wikidata" text,
	"wikipedia" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bicycle_racks_osm_id_unique" UNIQUE("osm_id")
);
--> statement-breakpoint
CREATE TABLE "counting_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"location_id" integer NOT NULL,
	"counting_date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"total_cyclists" integer DEFAULT 0 NOT NULL,
	"max_hour_cyclists" integer DEFAULT 0 NOT NULL,
	"weather_conditions" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "counting_locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"city" varchar(100) NOT NULL,
	"state" varchar(2) NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "counting_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"session_label" varchar(10) NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"total_cyclists" integer DEFAULT 0 NOT NULL,
	"characteristics" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"from_direction" "direction" NOT NULL,
	"to_direction" "direction" NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cyclist_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emergency_calls" (
	"id" serial PRIMARY KEY NOT NULL,
	"original_id" integer NOT NULL,
	"date" timestamp NOT NULL,
	"time_minute" text NOT NULL,
	"municipality" text,
	"neighborhood" text,
	"address" text,
	"call_origin" text,
	"origin_type" text,
	"subtype" text,
	"gender" text,
	"age" integer,
	"finalization_reason" text,
	"outcome_reason" text,
	"type" text,
	"category" text,
	"finalization_reason_normalized" text,
	"outcome_reason_normalized" text,
	"finalization_category" text,
	"outcome_category" text,
	"pcr_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "traffic_calls" (
	"id" serial PRIMARY KEY NOT NULL,
	"datetime" timestamp NOT NULL,
	"nature" varchar(50) NOT NULL,
	"total_victims" integer DEFAULT 0,
	"injured_victims" integer DEFAULT 0,
	"fatal_victims" integer DEFAULT 0,
	"street_name" varchar(255) NOT NULL,
	"neighborhood" varchar(100) NOT NULL,
	"coordinates" text,
	"crash_data" jsonb NOT NULL,
	"environmental_data" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "traffic_deaths" (
	"id" serial PRIMARY KEY NOT NULL,
	"contador" integer,
	"tipobito" varchar(1),
	"dtobito" date NOT NULL,
	"horaobito" varchar(10),
	"natural" varchar(3),
	"codmunnatu" integer,
	"dtnasc" date,
	"idade" integer,
	"sexo" varchar(1),
	"racacor" varchar(1),
	"estciv" varchar(1),
	"esc" varchar(1),
	"esc2010" varchar(1),
	"seriescfal" varchar(2),
	"ocup" varchar(6),
	"codmunres" integer,
	"lococor" varchar(1),
	"codestab" varchar(7),
	"estabdescr" text,
	"codmunocor" integer,
	"linhaa" text,
	"linhab" text,
	"linhac" text,
	"linhad" text,
	"linhaii" text,
	"causabas" text NOT NULL,
	"causabas_o" text,
	"cb_pre" text,
	"circobito" varchar(1),
	"acidtrab" varchar(1),
	"fonte" varchar(1),
	"origem" varchar(1),
	"assistmed" varchar(1),
	"exame" varchar(1),
	"cirurgia" varchar(1),
	"necropsia" varchar(1),
	"dtinvestig" date,
	"dtcadastro" date,
	"dtrecebim" date,
	"numerolote" varchar(20),
	"tppos" varchar(1),
	"atestante" varchar(1),
	"stcodifica" varchar(1),
	"codificado" varchar(1),
	"versaosist" varchar(10),
	"versaoscb" varchar(10),
	"data_year" integer,
	"import_batch" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
	"complementary_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "counting_events" ADD CONSTRAINT "counting_events_location_id_counting_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."counting_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counting_sessions" ADD CONSTRAINT "counting_sessions_event_id_counting_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."counting_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_movements" ADD CONSTRAINT "session_movements_session_id_counting_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."counting_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_dtobito" ON "traffic_deaths" USING btree ("dtobito");--> statement-breakpoint
CREATE INDEX "idx_codmunocor" ON "traffic_deaths" USING btree ("codmunocor");--> statement-breakpoint
CREATE INDEX "idx_codmunres" ON "traffic_deaths" USING btree ("codmunres");--> statement-breakpoint
CREATE INDEX "idx_causabas" ON "traffic_deaths" USING btree ("causabas");--> statement-breakpoint
CREATE INDEX "idx_data_year" ON "traffic_deaths" USING btree ("data_year");--> statement-breakpoint
CREATE INDEX "idx_year_munocor" ON "traffic_deaths" USING btree ("data_year","codmunocor");