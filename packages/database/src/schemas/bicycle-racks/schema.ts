import { jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// ============================================================================
// Bicycle Racks Schema
// ============================================================================

export const bicycleRacks = pgTable("bicycle_racks", {
	id: serial("id").primaryKey(),
	osm_id: text("osm_id"),
	osm_type: text("osm_type"), // 'node', 'way', 'relation'
	
	// Campos OSM diretos
	name: text("name"),
	description: text("description"),
	amenity: text("amenity").default("bicycle_parking"),
	bicycle_parking: text("bicycle_parking"), // 'stands', 'wall_loops', 'shed', 'paraciclo'
	capacity: text("capacity"), // mantém como TEXT igual no OSM
	access: text("access"), // 'yes', 'private', 'permissive', 'customers'
	covered: text("covered"), // 'yes', 'no'
	fee: text("fee"), // 'yes', 'no'
	supervised: text("supervised"), // 'yes', 'no'
	lit: text("lit"), // 'yes', 'no'
	
	// Operação
	operator: text("operator"),
	operator_type: text("operator_type"), // 'private', 'public', 'association'
	ref: text("ref"), // código de referência
	
	// Extras OSM
	level: text("level"),
	surface: text("surface"),
	building: text("building"),
	payment_none: text("payment_none"),
	
	// Metadados
	source: text("source"),
	source_date: text("source_date"),
	metadata: jsonb("metadata"), // outros campos OSM não mapeados
	created_at: timestamp("created_at").defaultNow().notNull(),
	updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// Zod Schemas
// ============================================================================

export const insertBicycleRackSchema = createInsertSchema(bicycleRacks);
export const selectBicycleRackSchema = createSelectSchema(bicycleRacks);

// ============================================================================
// TypeScript Types
// ============================================================================

export type BicycleRack = typeof bicycleRacks.$inferSelect;
export type InsertBicycleRack = typeof bicycleRacks.$inferInsert;
