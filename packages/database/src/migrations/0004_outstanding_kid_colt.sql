CREATE TABLE "pcr_streets" (
	"id" serial PRIMARY KEY NOT NULL,
	"object_id" integer NOT NULL,
	"clogra_codi" integer NOT NULL,
	"nlogra_conc" text NOT NULL,
	"nlgpav_ofic" text NOT NULL,
	"nlgpav_resu" text NOT NULL,
	"flgpav_indp" text,
	"indpav" text,
	"ct" text,
	"nm_perimetr" text,
	"nm_tp_via" text,
	"trecho_sul" text,
	"db2gse_sde" real,
	"coordinates" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pcr_streets_object_id_unique" UNIQUE("object_id")
);