import {
	integer,
	jsonb,
	pgTable,
	serial,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// TrafficCalls Schema
// ============================================================================

/**
 * Traffic Calls (Sinistros) Table
 * Stores traffic incident data from CTTU (2016-2024)
 *
 * Design: Hybrid approach with indexed columns for common queries
 * and JSONB fields for flexible data storage
 */
export const trafficCalls = pgTable("traffic_calls", {
	// Primary Key
	id: serial("id").primaryKey(),

	// Temporal (indexed for date range queries)
	datetime: timestamp("datetime").notNull(),

	// Classification (indexed for filtering)
	nature: varchar("nature", { length: 50 }).notNull(), // natureza_acidente

	// Location (indexed for geographic queries)
	street_name: varchar("street_name", { length: 255 }).notNull(), // endereco
	neighborhood: varchar("neighborhood", { length: 100 }).notNull(), // bairro
	coordinates: text("coordinates"), // Future: PostGIS POINT for geocoding

	// Victims (indexed for statistics)
	total_victims: integer("total_victims").default(0),
	injured_victims: integer("injured_victims").default(0), // total_victims - fatal_victims
	fatal_victims: integer("fatal_victims").default(0),

	// Flexible data in JSONB
	crash_data: jsonb("crash_data").notNull(),
	environmental_data: jsonb("environmental_data"),
	metadata: jsonb("metadata"),

	// Timestamps
	created_at: timestamp("created_at").defaultNow().notNull(),
	updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// Zod Schemas for JSONB Fields
// ============================================================================

/**
 * Crash Data Schema
 * Contains incident details and vehicle information
 */
export const crashDataSchema = z.object({
	type: z.string(), // tipo: COLISÃO, ATROPELAMENTO, etc.
	description: z.string(), // descricao
	vehicles: z.object({
		cars: z.number().default(0), // auto
		motorcycles: z.number().default(0), // moto
		bicycles: z.number().default(0), // ciclom
		cyclists: z.number().default(0), // ciclista
		pedestrians: z.number().default(0), // pedestre
		buses: z.number().default(0), // onibus
		trucks: z.number().default(0), // caminhao
		police_vehicles: z.number().default(0), // viatura
		others: z.number().default(0), // outros
	}),
});

/**
 * Environmental Data Schema
 * Contains road and weather conditions
 */
export const environmentalDataSchema = z
	.object({
		weather: z.string().optional(), // tempo_clima
		traffic_light_number: z.string().optional(), // num_semaforo
		traffic_light_status: z.string().optional(), // situacao_semaforo
		signage: z.string().optional(), // sinalizacao
		road_conditions: z.string().optional(), // condicao_via
		road_conservation: z.string().optional(), // conservacao_via
		road_direction: z.string().optional(), // sentido_via
		sign_status: z.string().optional(), // situacao_placa
		max_speed: z.string().optional(), // velocidade_max_via
		traffic_direction: z.string().optional(), // mao_direcao
		road_divisions: z.array(z.string()).optional(), // divisao_via1, divisao_via2, divisao_via3
	})
	.optional();

/**
 * Metadata Schema
 * Contains administrative and additional location details
 */
export const metadataSchema = z
	.object({
		original_id: z.string().optional(), // _id
		protocol: z.string().optional(), // Protocolo
		status: z.string().optional(), // situacao
		verified: z.boolean().optional(), // acidente_verificado
		control_point: z.string().optional(), // ponto_controle
		location_details: z
			.object({
				street_number: z.string().optional(), // numero
				address_detail: z.string().optional(), // detalhe_endereco_acidente
				complement: z.string().optional(), // complemento
				cross_street: z.string().optional(), // endereco_cruzamento
				cross_street_number: z.string().optional(), // numero_cruzamento
				cross_street_reference: z.string().optional(), // referencia_cruzamento
				cross_street_neighborhood: z.string().optional(), // bairro_cruzamento
			})
			.optional(),
	})
	.optional();

// ============================================================================
// Drizzle-Zod Schemas
// ============================================================================

export const insertTrafficCallSchema = createInsertSchema(trafficCalls, {
	crash_data: crashDataSchema,
	environmental_data: environmentalDataSchema,
	metadata: metadataSchema,
});

export const selectTrafficCallSchema = createSelectSchema(trafficCalls, {
	crash_data: crashDataSchema,
	environmental_data: environmentalDataSchema,
	metadata: metadataSchema,
});

// ============================================================================
// TypeScript Types
// ============================================================================

export type TrafficCall = typeof trafficCalls.$inferSelect;
export type InsertTrafficCall = typeof trafficCalls.$inferInsert;
export type CrashData = z.infer<typeof crashDataSchema>;
export type EnvironmentalData = z.infer<typeof environmentalDataSchema>;
export type Metadata = z.infer<typeof metadataSchema>;
