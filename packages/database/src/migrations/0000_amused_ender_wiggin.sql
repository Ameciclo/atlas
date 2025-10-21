CREATE TABLE "cyclist_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
