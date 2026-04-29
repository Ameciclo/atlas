import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// ============================================================================
// Bicycle Racks Schema
// ============================================================================

export const bicycleRacks = pgTable("bicycle_racks", {
	id: serial("id").primaryKey(),
	osm_id: text("osm_id").unique(),
	osm_type: text("osm_type"), // 'node', 'way', 'relation'

	// Coordenadas (será convertida para PostGIS depois)
	coordinates: text("coordinates"), // temporário, será geometry(Point, 4326)

	// Campos OSM principais
	name: text("name"),
	description: text("description"),
	amenity: text("amenity").default("bicycle_parking"),
	bicycle_parking: text("bicycle_parking"), // 'stands', 'wall_loops', 'shed', 'building', 'rack'
	capacity: text("capacity"),
	access: text("access"), // 'yes', 'private', 'permissive', 'customers'
	covered: text("covered"), // 'yes', 'no'
	fee: text("fee"), // 'yes', 'no'
	supervised: text("supervised"), // 'yes', 'no'
	lit: text("lit"), // 'yes', 'no'

	// Operação e localização
	operator: text("operator"),
	operator_type: text("operator_type"), // 'private', 'public', 'association'
	building: text("building"), // 'yes', 'roof', 'retail'
	level: text("level"),
	surface: text("surface"),

	// Endereço (quando disponível)
	addr_city: text("addr_city"),
	addr_street: text("addr_street"),
	addr_housenumber: text("addr_housenumber"),
	addr_suburb: text("addr_suburb"),
	addr_postcode: text("addr_postcode"),

	// Horários e pagamento
	opening_hours: text("opening_hours"),
	payment_none: text("payment_none"),

	// Referências
	ref: text("ref"),
	source: text("source"),
	source_date: text("source_date"),
	wikidata: text("wikidata"),
	wikipedia: text("wikipedia"),

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

// ============================================================================
// Bicycle Rack Cities Schema
// ============================================================================

export const bicycleRackCities = pgTable("bicycle_rack_cities", {
	id: serial("id").primaryKey(),
	osm_id: text("osm_id").notNull().unique(),
	city: text("city").notNull(),
	state: text("state").default("PE"),
	created_at: timestamp("created_at").defaultNow().notNull(),
	updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBicycleRackCitySchema =
	createInsertSchema(bicycleRackCities);
export const selectBicycleRackCitySchema =
	createSelectSchema(bicycleRackCities);

export type BicycleRackCity = typeof bicycleRackCities.$inferSelect;
export type InsertBicycleRackCity = typeof bicycleRackCities.$inferInsert;
