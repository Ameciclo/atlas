import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// ============================================================================
// Cycling Infrastructure Schema
// ============================================================================

export const cyclingInfrastructure = pgTable("cycling_infrastructure", {
	id: serial("id").primaryKey(),
	infra_type: text("infra_type").notNull(), // bike_lane, cycle_track, shared_path, etc.
	status: text("status").notNull(), // existing, planned, under_construction
	length_meters: integer("length_meters"),
	width_meters: integer("width_meters"),
	surface_type: text("surface_type"), // asphalt, concrete, paved, unpaved
	coordinates: text("coordinates").notNull(), // temporary text, will convert to PostGIS
	complementary_data: jsonb("complementary_data"),
	created_at: timestamp("created_at").defaultNow().notNull(),
	updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// Zod Schemas
// ============================================================================

export const insertCyclingInfrastructureSchema = createInsertSchema(cyclingInfrastructure);
export const selectCyclingInfrastructureSchema = createSelectSchema(cyclingInfrastructure);

// ============================================================================
// TypeScript Types
// ============================================================================

export type CyclingInfrastructure = typeof cyclingInfrastructure.$inferSelect;
export type InsertCyclingInfrastructure = typeof cyclingInfrastructure.$inferInsert;
