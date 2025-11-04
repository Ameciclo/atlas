import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// ============================================================================
// SharedBike Schema
// ============================================================================

export const sharedBikeStations = pgTable("shared_bike_stations", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	address: text("address").notNull(),
	coordinates: text("coordinates").notNull(), // Will be converted to PostGIS geometry
	capacity: integer("capacity").notNull(),
	available_bikes: integer("available_bikes").notNull().default(0),
	available_docks: integer("available_docks").notNull().default(0),
	status: text("status").notNull().default("active"), // active, inactive, maintenance
	metadata: jsonb("metadata"), // Additional station info
	created_at: timestamp("created_at").defaultNow().notNull(),
	updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// Zod Schemas
// ============================================================================

export const insertSharedBikeStationSchema = createInsertSchema(sharedBikeStations);
export const selectSharedBikeStationSchema = createSelectSchema(sharedBikeStations);

// ============================================================================
// TypeScript Types
// ============================================================================

export type SharedBikeStation = typeof sharedBikeStations.$inferSelect;
export type InsertSharedBikeStation = typeof sharedBikeStations.$inferInsert;
