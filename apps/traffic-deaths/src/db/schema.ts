import { integer, pgTable, serial, text, timestamp, date, varchar, check } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";

export const traffic_deaths = pgTable("traffic_deaths", {
	id: serial("id").primaryKey(),
	contador: integer("contador"),
	// Tipo de óbito: 1=Fetal, 2=Não fetal
	tipobito: varchar("tipobito", { length: 1 }),
	dtobito: date("dtobito").notNull(),
	// Hora no formato HHMM
	horaobito: text("horaobito"),
	natural: varchar("natural", { length: 3 }),
	// Código município 6 dígitos
	codmunnatu: integer("codmunnatu"),
	dtnasc: date("dtnasc"),
	// Idade em anos
	idade: integer("idade"),
	// Sexo: M=Masculino, F=Feminino, I=Ignorado
	sexo: varchar("sexo", { length: 1 }),
	// Raça/Cor: 1=Branca, 2=Preta, 3=Amarela, 4=Parda, 5=Indígena, 9=Ignorado
	racacor: varchar("racacor", { length: 1 }),
	// Estado civil: 1=Solteiro, 2=Casado, 3=Viúvo, 4=Separado, 5=União estável, 9=Ignorado
	estciv: varchar("estciv", { length: 1 }),
	esc2010: varchar("esc2010", { length: 1 }),
	seriescfal: varchar("seriescfal", { length: 2 }),
	// Ocupação - código CBO
	ocup: varchar("ocup", { length: 6 }),
	codmunres: integer("codmunres"),
	// Local ocorrência: 1=Hospital, 2=Outros estab. saúde, 3=Domicílio, 4=Via pública, 5=Outros, 9=Ignorado
	lococor: varchar("lococor", { length: 1 }),
	codmunocor: integer("codmunocor"),
	// Linhas A, B, C, D - causas da morte (CID-10)
	linhaa: text("linhaa"),
	linhab: text("linhab"),
	linhac: text("linhac"),
	linhad: text("linhad"),
	linhaii: text("linhaii"),
	// Circunstância óbito: 1=Acidente, 2=Suicídio, 3=Homicídio, 4=Outros, 9=Ignorado
	circobito: varchar("circobito", { length: 1 }),
	// Acidente trabalho: S=Sim, N=Não, I=Ignorado
	acidtrab: varchar("acidtrab", { length: 1 }),
	// Fonte: 1=Boletim ocorrência, 2=Hospital, 3=Família, 4=Outra, 9=Ignorado
	fonte: varchar("fonte", { length: 1 }),
	origem: varchar("origem", { length: 1 }),
	esc: varchar("esc", { length: 1 }),
	// Necropsia: 1=Sim, 2=Não, 9=Ignorado
	exame: varchar("exame", { length: 1 }),
	// Cirurgia: 1=Sim, 2=Não, 9=Ignorado
	cirurgia: varchar("cirurgia", { length: 1 }),
	dtinvestig: date("dtinvestig"),
	// Causa básica original
	causabas_o: text("causabas_o"),
	// Causa básica - código CID-10
	causabas: text("causabas"),
	created_at: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
	// Constraints mínimos baseados nos dados reais do DATASUS
	check_sexo: check("check_sexo", sql`${table.sexo} IN ('0', '1', '2') OR ${table.sexo} IS NULL`),
	check_tipobito: check("check_tipobito", sql`${table.tipobito} IN ('1', '2') OR ${table.tipobito} IS NULL`),
	check_acidtrab: check("check_acidtrab", sql`${table.acidtrab} IN ('1', '2', '9') OR ${table.acidtrab} IS NULL`),
}));

export const insertTrafficDeath = createInsertSchema(traffic_deaths);
export const selectTrafficDeath = createSelectSchema(traffic_deaths);

export type TrafficDeath = typeof traffic_deaths.$inferSelect;
export type InsertTrafficDeath = typeof traffic_deaths.$inferInsert;
