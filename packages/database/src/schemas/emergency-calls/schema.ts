import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// ============================================================================
// Emergency Calls Schema
// ============================================================================

export const emergencyCalls = pgTable("emergency_calls", {
	id: serial("id").primaryKey(),
	original_id: integer("original_id").notNull(),
	pcr_street_id: integer("pcr_street_id"),
	date: timestamp("date").notNull(),
	time_minute: text("time_minute").notNull(),
	municipality: text("municipality"),
	neighborhood: text("neighborhood"),
	address: text("address"),
	call_origin: text("call_origin"),
	origin_type: text("origin_type"),
	subtype: text("subtype"),
	gender: text("gender"),
	age: integer("age"),
	finalization_reason: text("finalization_reason"),
	outcome_reason: text("outcome_reason"),
	type: text("type"),
	category: text("category"),
	finalization_reason_normalized: text("finalization_reason_normalized"),
	outcome_reason_normalized: text("outcome_reason_normalized"),
	finalization_category: text("finalization_category"),
	outcome_category: text("outcome_category"),
	pcr_address: text("pcr_address"),
	created_at: timestamp("created_at").defaultNow().notNull(),
	updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// Zod Schemas
// ============================================================================

export const insertEmergencyCallSchema = createInsertSchema(emergencyCalls);
export const selectEmergencyCallSchema = createSelectSchema(emergencyCalls);

// ============================================================================
// TypeScript Types
// ============================================================================

export type EmergencyCall = typeof emergencyCalls.$inferSelect;
export type InsertEmergencyCall = typeof emergencyCalls.$inferInsert;
