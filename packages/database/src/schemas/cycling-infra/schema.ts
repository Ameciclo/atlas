import {
	boolean,
	integer,
	jsonb,
	pgTable,
	real,
	serial,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// ============================================================================
// Cities Table
// ============================================================================

export const cities = pgTable("cities", {
	id: integer("id").primaryKey(),
	name: text("name").notNull(),
	state: text("state").notNull(),
	full_state: text("full_state").notNull(),
	rmr: boolean("rmr").notNull().default(false), // Região Metropolitana do Recife
	created_at: timestamp("created_at").defaultNow().notNull(),
	updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// Cycling Infrastructure Relations (PDC Projects)
// ============================================================================

export const cyclistInfraRelations = pgTable("cyclist_infra_relations", {
	id: serial("id").primaryKey(),
	osm_id: text("osm_id"),
	pdc_ref: text("pdc_ref"), // CM01, CCV01, CCF01, CCR01
	pdc_typology: text("pdc_typology"), // Ciclovia, Ciclofaixa, Ciclorrota
	name: text("name"),
	pdc_stretch: text("pdc_stretch"), // Descrição do trecho
	pdc_cities: text("pdc_cities"), // Cidades do PDC
	pdc_notes: text("pdc_notes"),
	notes: text("notes"), // existing, proposed, planned
	pdc_km: real("pdc_km"), // Quilometragem planejada
	created_at: timestamp("created_at").defaultNow().notNull(),
	updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// PDC Relations Ways (OSM ways from PDC relations)
// ============================================================================

export const pdcRelationWays = pgTable("pdc_relation_ways", {
	id: serial("id").primaryKey(),
	osm_id: text("osm_id").notNull(), // @id from GeoJSON (relation/15997469)
	relation_id: integer("relation_id").references(
		() => cyclistInfraRelations.id,
	),
	name: text("name"),
	geometry_type: text("geometry_type").notNull(), // MultiLineString, LineString, Polygon, Point
	coordinates: text("coordinates").notNull(), // Placeholder for PostGIS conversion
	osm_properties: jsonb("osm_properties").notNull(), // All OSM properties from GeoJSON
	geojson: jsonb("geojson").notNull(),
	created_at: timestamp("created_at").defaultNow().notNull(),
	updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// Relation Cities (N:N between Relations and Cities)
// ============================================================================

export const cyclistInfraRelationCities = pgTable(
	"cyclist_infra_relation_cities",
	{
		id: serial("id").primaryKey(),
		relation_id: integer("relation_id")
			.references(() => cyclistInfraRelations.id)
			.notNull(),
		city_id: integer("city_id")
			.references(() => cities.id)
			.notNull(),
		created_at: timestamp("created_at").defaultNow().notNull(),
	},
);

// ============================================================================
// Zod Schemas
// ============================================================================

export const insertCitiesSchema = createInsertSchema(cities);
export const selectCitiesSchema = createSelectSchema(cities);

export const insertCyclistInfraRelationsSchema = createInsertSchema(
	cyclistInfraRelations,
);
export const selectCyclistInfraRelationsSchema = createSelectSchema(
	cyclistInfraRelations,
);

export const insertPdcRelationWaysSchema = createInsertSchema(pdcRelationWays);
export const selectPdcRelationWaysSchema = createSelectSchema(pdcRelationWays);

// ============================================================================
// City Boundaries (IBGE Municipal Limits from GeoJSON)
// ============================================================================

export const cityBoundaries = pgTable("city_boundaries", {
	id: serial("id").primaryKey(),
	city_id: integer("city_id")
		.references(() => cities.id)
		.notNull(),
	name: text("name").notNull(),
	boundary: text("boundary").notNull(), // PostGIS geometry(MultiPolygon, 4326)
	created_at: timestamp("created_at").defaultNow().notNull(),
	updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// PostGIS Migration Notes:
// - coordinates field will be converted to geometry type based on geometry_type for pdc_relation_ways
// - Use ST_GeomFromGeoJSON() to convert from GeoJSON coordinates

export const insertCyclistInfraRelationCitiesSchema = createInsertSchema(
	cyclistInfraRelationCities,
);
export const selectCyclistInfraRelationCitiesSchema = createSelectSchema(
	cyclistInfraRelationCities,
);

export const insertCityBoundariesSchema = createInsertSchema(cityBoundaries);
export const selectCityBoundariesSchema = createSelectSchema(cityBoundaries);

// ============================================================================
// TypeScript Types
// ============================================================================

export type Cities = typeof cities.$inferSelect;
export type InsertCities = typeof cities.$inferInsert;

export type CyclistInfraRelations = typeof cyclistInfraRelations.$inferSelect;
export type InsertCyclistInfraRelations =
	typeof cyclistInfraRelations.$inferInsert;

export type PdcRelationWays = typeof pdcRelationWays.$inferSelect;
export type InsertPdcRelationWays = typeof pdcRelationWays.$inferInsert;

export type CyclistInfraRelationCities =
	typeof cyclistInfraRelationCities.$inferSelect;
export type InsertCyclistInfraRelationCities =
	typeof cyclistInfraRelationCities.$inferInsert;

export type CityBoundaries = typeof cityBoundaries.$inferSelect;
export type InsertCityBoundaries = typeof cityBoundaries.$inferInsert;
