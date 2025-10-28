import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// ============================================================================
// TrafficCrashes Schema
// ============================================================================

export const geolocatedCrashes = pgTable("geolocated_crashes", {
	id: serial("id").primaryKey(),
	timestamp: timestamp("timestamp").notNull(),
	n_injured: integer("n_injured").notNull().default(0),
	n_deaths: integer("n_deaths").notNull().default(0),
	coordinates: text("coordinates").notNull(), // Placeholder for PostGIS point
	complementary_data: jsonb("complementary_data").notNull(),
	created_at: timestamp("created_at").defaultNow().notNull(),
	updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// Zod Schemas
// ============================================================================

export const insertGeolocatedCrashSchema = createInsertSchema(geolocatedCrashes);
export const selectGeolocatedCrashSchema = createSelectSchema(geolocatedCrashes);

// ============================================================================
// TypeScript Types
// ============================================================================

export type GeolocatedCrash = typeof geolocatedCrashes.$inferSelect;
export type InsertGeolocatedCrash = typeof geolocatedCrashes.$inferInsert;
