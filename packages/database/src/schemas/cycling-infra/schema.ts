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
// Ciclomapa Data (curated cycling infrastructure)
// Only LineString features with types: Ciclovia, Ciclofaixa, Ciclorrota, Calçada compartilhada
// ============================================================================

export const ciclomapaInfra = pgTable("ciclomapa_infra", {
	id: serial("id").primaryKey(),
	osm_id: text("osm_id").notNull(), // way/590791005, way/618688179
	name: text("name"), // 93.9% coverage in data
	infra_type: text("infra_type").notNull(), // Ciclovia, Ciclofaixa, Ciclorrota, Calçada compartilhada
	coordinates: text("coordinates").notNull(), // Placeholder for PostGIS conversion
	geojson: jsonb("geojson").notNull(), // Full GeoJSON feature
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

export const insertCiclomapaInfraSchema = createInsertSchema(ciclomapaInfra);
export const selectCiclomapaInfraSchema = createSelectSchema(ciclomapaInfra);

// ============================================================================
// Métricas para Análise PDC vs Realidade OSM
// ============================================================================

// Análise por OSMID:
// 1. PDC Feito: osm_id IN (ciclomapa_infra) AND osm_id IN (pdc_relation_ways)
// 2. Fora PDC: osm_id IN (ciclomapa_infra) AND osm_id NOT IN (pdc_relation_ways)
// 3. PDC Não Feito: osm_id IN (pdc_relation_ways) AND osm_id NOT IN (ciclomapa_infra)

// PostGIS Migration Notes:
// - coordinates field will be converted to geometry(LineString, 4326) for ciclomapa_infra
// - coordinates field will be converted to geometry type based on geometry_type for pdc_relation_ways
// - Use ST_GeomFromGeoJSON() to convert from GeoJSON coordinates

export const insertCyclistInfraRelationCitiesSchema = createInsertSchema(
	cyclistInfraRelationCities,
);
export const selectCyclistInfraRelationCitiesSchema = createSelectSchema(
	cyclistInfraRelationCities,
);

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

export type CiclomapaInfra = typeof ciclomapaInfra.$inferSelect;
export type InsertCiclomapaInfra = typeof ciclomapaInfra.$inferInsert;

export type CyclistInfraRelationCities =
	typeof cyclistInfraRelationCities.$inferSelect;
export type InsertCyclistInfraRelationCities =
	typeof cyclistInfraRelationCities.$inferInsert;
