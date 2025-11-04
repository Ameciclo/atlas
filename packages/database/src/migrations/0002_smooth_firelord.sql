CREATE TABLE "test_db_service_examples" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "traffic_deaths" (
	"id" serial PRIMARY KEY NOT NULL,
	"contador" integer,
	"tipobito" varchar(1),
	"dtobito" date NOT NULL,
	"horaobito" varchar(4),
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
CREATE INDEX "idx_dtobito" ON "traffic_deaths" USING btree ("dtobito");--> statement-breakpoint
CREATE INDEX "idx_codmunocor" ON "traffic_deaths" USING btree ("codmunocor");--> statement-breakpoint
CREATE INDEX "idx_codmunres" ON "traffic_deaths" USING btree ("codmunres");--> statement-breakpoint
CREATE INDEX "idx_causabas" ON "traffic_deaths" USING btree ("causabas");--> statement-breakpoint
CREATE INDEX "idx_data_year" ON "traffic_deaths" USING btree ("data_year");--> statement-breakpoint
CREATE INDEX "idx_year_munocor" ON "traffic_deaths" USING btree ("data_year","codmunocor");