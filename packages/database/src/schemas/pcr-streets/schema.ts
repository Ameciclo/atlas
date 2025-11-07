import { integer, pgTable, real, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// ============================================================================
// PCR Streets Schema
// ============================================================================

export const pcrStreets = pgTable("pcr_streets", {
	id: serial("id").primaryKey(),
	
	// Identificadores únicos
	object_id: integer("object_id").notNull().unique(),
	clogra_codi: integer("clogra_codi").notNull(), // Código do logradouro
	
	// Nomes da rua
	nlogra_conc: text("nlogra_conc").notNull(), // Nome completo concatenado
	nlgpav_ofic: text("nlgpav_ofic").notNull(), // Nome oficial pavimentado
	nlgpav_resu: text("nlgpav_resu").notNull(), // Nome resumido pavimentado
	
	// Status de pavimentação
	flgpav_indp: text("flgpav_indp"), // Flag indicador pavimentação (S/N/P/X)
	indpav: text("indpav"), // Indicador pavimentação (Via Pavimentada, Via Não Pavimentada, etc.)
	
	// Campos opcionais
	ct: text("ct"), // Campo CT (geralmente null)
	nm_perimetr: text("nm_perimetr"), // Nome perímetro
	nm_tp_via: text("nm_tp_via"), // Nome tipo via
	
	// Timestamp e comprimento
	trecho_sul: text("trecho_sul"), // Timestamp do trecho sul
	db2gse_sde: real("db2gse_sde"), // Comprimento do segmento
	
	// Coordenadas geográficas (placeholder para PostGIS)
	coordinates: text("coordinates").notNull(), // Será convertido para geometry(MultiLineString, 4326) posteriormente
	
	created_at: timestamp("created_at").defaultNow().notNull(),
	updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// Zod Schemas
// ============================================================================

export const insertPcrStreetSchema = createInsertSchema(pcrStreets);
export const selectPcrStreetSchema = createSelectSchema(pcrStreets);

// ============================================================================
// TypeScript Types
// ============================================================================

export type PcrStreet = typeof pcrStreets.$inferSelect;
export type InsertPcrStreet = typeof pcrStreets.$inferInsert;
