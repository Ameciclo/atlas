CREATE TYPE "public"."direction" AS ENUM('north', 'east', 'south', 'west');--> statement-breakpoint
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
ALTER TABLE "counting_events" ADD CONSTRAINT "counting_events_location_id_counting_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."counting_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counting_sessions" ADD CONSTRAINT "counting_sessions_event_id_counting_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."counting_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_movements" ADD CONSTRAINT "session_movements_session_id_counting_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."counting_sessions"("id") ON DELETE cascade ON UPDATE no action;