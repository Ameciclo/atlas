CREATE TABLE "cyclists_counts" (
	"id" integer PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"metadata" jsonb NOT NULL,
	"coordinates" geometry(point),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "spatial_index" ON "cyclists_counts" USING gist ("coordinates");