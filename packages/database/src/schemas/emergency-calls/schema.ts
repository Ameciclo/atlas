import { jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// ============================================================================
// EmergencyCalls Schema
// ============================================================================

export const examples = pgTable("emergency_calls_examples", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	data: jsonb("data").notNull(),
	created_at: timestamp("created_at").defaultNow().notNull(),
	updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// Zod Schemas
// ============================================================================

export const insertExampleSchema = createInsertSchema(examples);
export const selectExampleSchema = createSelectSchema(examples);

// ============================================================================
// TypeScript Types
// ============================================================================

export type Example = typeof examples.$inferSelect;
export type InsertExample = typeof examples.$inferInsert;
