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
// Enums
// ============================================================================



// ============================================================================
// Traffic Crashes Schema
// ============================================================================

export const trafficCalls = pgTable("traffic_calls", {
	id: serial("id").primaryKey(),
	
	// Campos essenciais
	datetime: timestamp("datetime").notNull(),
	nature: varchar("nature", { length: 50 }).notNull(),
	total_victims: integer("total_victims").default(0),
	injured_victims: integer("injured_victims").default(0),
	fatal_victims: integer("fatal_victims").default(0),
	
	// Localização
	street_name: varchar("street_name", { length: 255 }).notNull(),
	neighborhood: varchar("neighborhood", { length: 100 }).notNull(),
	coordinates: text("coordinates"), // PostGIS depois
	
	// Dados flexíveis
	crash_data: jsonb("crash_data").notNull(),
	environmental_data: jsonb("environmental_data"),
	metadata: jsonb("metadata"),
	
	created_at: timestamp("created_at").defaultNow().notNull(),
	updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// Zod Schemas
// ============================================================================

// Crash data schema for validation
export const crashDataSchema = z.object({
	type: z.string().optional(), // COLISÃO, ATROPELAMENTO
	description: z.string().optional(),
	address: z.string().optional(),
	vehicles: z
		.object({
			cars: z.number().int().min(0).default(0),
			motorcycles: z.number().int().min(0).default(0),
			bicycles: z.number().int().min(0).default(0),
			cyclists: z.number().int().min(0).default(0),
			pedestrians: z.number().int().min(0).default(0),
			buses: z.number().int().min(0).default(0),
			trucks: z.number().int().min(0).default(0),
			police_vehicles: z.number().int().min(0).default(0),
			others: z.number().int().min(0).default(0),
		})
		.optional(),
});

// Environmental data schema
export const environmentalDataSchema = z
	.object({
		weather: z.string().optional(),
		traffic_light_status: z.string().optional(),
		signage: z.string().optional(),
		road_conditions: z.string().optional(),
		road_conservation: z.string().optional(),
		max_speed: z.string().optional(),
	})
	.optional();

// Metadata schema
export const metadataSchema = z
	.object({
		original_id: z.string().optional(),
		protocol: z.string().optional(),
		verified: z.boolean().optional(),
		notes: z.string().optional(),
	})
	.optional();



// Traffic Calls schemas
export const selectTrafficCallSchema = createSelectSchema(trafficCalls);
export const insertTrafficCallSchema = createInsertSchema(trafficCalls, {
	crash_data: crashDataSchema,
	environmental_data: environmentalDataSchema,
	metadata: metadataSchema,
});



// ============================================================================
// TypeScript Types
// ============================================================================

export type TrafficCall = typeof trafficCalls.$inferSelect;
export type NewTrafficCall = typeof trafficCalls.$inferInsert;
export type CrashData = z.infer<typeof crashDataSchema>;
export type EnvironmentalData = z.infer<typeof environmentalDataSchema>;
export type Metadata = z.infer<typeof metadataSchema>;

