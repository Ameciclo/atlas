CREATE TABLE "test_db_service_examples" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "traffic_calls" (
	"id" serial PRIMARY KEY NOT NULL,
	"datetime" timestamp NOT NULL,
	"nature" varchar(50) NOT NULL,
	"street_name" varchar(255) NOT NULL,
	"neighborhood" varchar(100) NOT NULL,
	"coordinates" text,
	"total_victims" integer DEFAULT 0,
	"injured_victims" integer DEFAULT 0,
	"fatal_victims" integer DEFAULT 0,
	"crash_data" jsonb NOT NULL,
	"environmental_data" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
