import {
	boolean,
	integer,
	jsonb,
	pgTable,
	serial,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// ============================================================================
// SharedBike Schema
// ============================================================================

export const sharedBikeStations = pgTable("shared_bike_stations", {
	id: serial("id").primaryKey(),
	osm_id: text("osm_id").notNull().unique(), // OpenStreetMap ID (e.g., "node/7204299969")
	name: text("name").notNull(),
	ref: text("ref"), // Station reference number (e.g., "79")
	coordinates: text("coordinates").notNull(), // Will be converted to PostGIS geometry
	capacity: integer("capacity").notNull(),
	network: text("network").notNull(), // "BikePE" or "Bike PE"
	operator: text("operator").notNull().default("Tembici"),
	operator_type: text("operator_type").default("private"),
	bicycle_rental_type: text("bicycle_rental_type"), // "docking_station" or null
	fee: boolean("fee").default(true),
	payment_credit_cards: boolean("payment_credit_cards").default(true),
	payment_debit_cards: boolean("payment_debit_cards").default(false),
	alt_name: text("alt_name"), // Alternative name
	properties: jsonb("properties"), // All original OSM properties
	created_at: timestamp("created_at").defaultNow().notNull(),
	updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// Zod Schemas
// ============================================================================

export const insertSharedBikeStationSchema =
	createInsertSchema(sharedBikeStations);
export const selectSharedBikeStationSchema =
	createSelectSchema(sharedBikeStations);

// ============================================================================
// TypeScript Types
// ============================================================================

export type SharedBikeStation = typeof sharedBikeStations.$inferSelect;
export type InsertSharedBikeStation = typeof sharedBikeStations.$inferInsert;
