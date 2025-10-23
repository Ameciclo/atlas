import {
	date,
	index,
	integer,
	pgTable,
	serial,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// TRAFFIC DEATHS TABLE (DATASUS SIM Data)
// ============================================================================
// This schema keeps the raw DATASUS data structure for easy annual updates
// Transformations and aggregations are done via materialized views

export const trafficDeaths = pgTable(
	"traffic_deaths",
	{
		id: serial("id").primaryKey(),

		// ====================================================================
		// IDENTIFICAÇÃO DO ÓBITO
		// ====================================================================
		contador: integer("contador"), // Número sequencial do registro
		tipobito: varchar("tipobito", { length: 1 }), // 1=Fetal, 2=Não fetal
		dtobito: date("dtobito").notNull(), // Data do óbito
		horaobito: varchar("horaobito", { length: 10 }), // Hora no formato HHMM (alguns registros têm formato incorreto DDMMYYYY)

		// ====================================================================
		// DADOS DO FALECIDO
		// ====================================================================
		natural: varchar("natural", { length: 3 }), // Naturalidade (código município)
		codmunnatu: integer("codmunnatu"), // Código município naturalidade (6 dígitos)
		dtnasc: date("dtnasc"), // Data de nascimento
		idade: integer("idade"), // Idade em anos
		sexo: varchar("sexo", { length: 1 }), // 0=Ignorado, 1=Masculino, 2=Feminino
		racacor: varchar("racacor", { length: 1 }), // 1=Branca, 2=Preta, 3=Amarela, 4=Parda, 5=Indígena, 9=Ignorado
		estciv: varchar("estciv", { length: 1 }), // Estado civil

		// ====================================================================
		// ESCOLARIDADE E OCUPAÇÃO
		// ====================================================================
		esc: varchar("esc", { length: 1 }), // Escolaridade (código antigo)
		esc2010: varchar("esc2010", { length: 1 }), // Escolaridade (padrão 2010)
		seriescfal: varchar("seriescfal", { length: 2 }), // Série escolar do falecido
		ocup: varchar("ocup", { length: 6 }), // Ocupação - código CBO

		// ====================================================================
		// LOCALIZAÇÃO
		// ====================================================================
		codmunres: integer("codmunres"), // Código município residência
		lococor: varchar("lococor", { length: 1 }), // Local da ocorrência: 1=Hospital, 2=Outros estab. saúde, 3=Domicílio, 4=Via pública, 5=Outros, 9=Ignorado
		codestab: varchar("codestab", { length: 7 }), // Código do estabelecimento
		estabdescr: text("estabdescr"), // Descrição do estabelecimento
		codmunocor: integer("codmunocor"), // Código município ocorrência

		// ====================================================================
		// CAUSAS DA MORTE (CID-10)
		// ====================================================================
		linhaa: text("linhaa"), // Linha A - causa imediata
		linhab: text("linhab"), // Linha B - causa intermediária
		linhac: text("linhac"), // Linha C - causa intermediária
		linhad: text("linhad"), // Linha D - causa básica
		linhaii: text("linhaii"), // Linha II - outras condições
		causabas: text("causabas").notNull(), // Causa básica - código CID-10
		causabas_o: text("causabas_o"), // Causa básica original
		cb_pre: text("cb_pre"), // Causa básica presumida

		// ====================================================================
		// CIRCUNSTÂNCIAS DO ÓBITO
		// ====================================================================
		circobito: varchar("circobito", { length: 1 }), // 1=Acidente, 2=Suicídio, 3=Homicídio, 4=Outros, 9=Ignorado
		acidtrab: varchar("acidtrab", { length: 1 }), // Acidente de trabalho: 1=Sim, 2=Não, 9=Ignorado
		fonte: varchar("fonte", { length: 1 }), // Fonte da informação
		origem: varchar("origem", { length: 1 }), // Origem do registro

		// ====================================================================
		// PROCEDIMENTOS E INVESTIGAÇÃO
		// ====================================================================
		assistmed: varchar("assistmed", { length: 1 }), // Assistência médica
		exame: varchar("exame", { length: 1 }), // Exame complementar
		cirurgia: varchar("cirurgia", { length: 1 }), // Cirurgia
		necropsia: varchar("necropsia", { length: 1 }), // Necropsia
		dtinvestig: date("dtinvestig"), // Data da investigação
		dtcadastro: date("dtcadastro"), // Data do cadastro
		dtrecebim: date("dtrecebim"), // Data do recebimento

		// ====================================================================
		// CONTROLE E VERSÃO
		// ====================================================================
		numerolote: varchar("numerolote", { length: 20 }), // Número do lote
		tppos: varchar("tppos", { length: 1 }), // Tipo de posição
		atestante: varchar("atestante", { length: 1 }), // Atestante
		stcodifica: varchar("stcodifica", { length: 1 }), // Status codificação
		codificado: varchar("codificado", { length: 1 }), // Codificado
		versaosist: varchar("versaosist", { length: 10 }), // Versão do sistema
		versaoscb: varchar("versaoscb", { length: 10 }), // Versão SCB

		// ====================================================================
		// METADADOS INTERNOS
		// ====================================================================
		data_year: integer("data_year"), // Ano dos dados (para facilitar queries)
		import_batch: varchar("import_batch", { length: 50 }), // Identificador do lote de importação
		created_at: timestamp("created_at").defaultNow().notNull(),
		updated_at: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => ({
		// Indexes para queries comuns
		idx_dtobito: index("idx_dtobito").on(table.dtobito),
		idx_codmunocor: index("idx_codmunocor").on(table.codmunocor),
		idx_codmunres: index("idx_codmunres").on(table.codmunres),
		idx_causabas: index("idx_causabas").on(table.causabas),
		idx_data_year: index("idx_data_year").on(table.data_year),
		idx_year_munocor: index("idx_year_munocor").on(
			table.data_year,
			table.codmunocor,
		),
	}),
);

// ============================================================================
// Zod Schemas
// ============================================================================

export const insertTrafficDeathSchema = createInsertSchema(trafficDeaths, {
	dtobito: z.coerce.date(),
	dtnasc: z.coerce.date().optional().nullable(),
	dtinvestig: z.coerce.date().optional().nullable(),
	dtcadastro: z.coerce.date().optional().nullable(),
	dtrecebim: z.coerce.date().optional().nullable(),
	idade: z.number().int().min(0).max(150).optional().nullable(),
	causabas: z.string().min(1), // Required field
});

export const selectTrafficDeathSchema = createSelectSchema(trafficDeaths);

// ============================================================================
// TypeScript Types
// ============================================================================

export type TrafficDeath = typeof trafficDeaths.$inferSelect;
export type InsertTrafficDeath = typeof trafficDeaths.$inferInsert;
