import {
	integer,
	pgTable,
	serial,
	text,
	timestamp,
	jsonb,
	boolean,
	numeric,
	index,
	unique,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// Street Codes Schema (derived from pcr_streets — one row per unique code)
// ============================================================================

export const streetCodes = pgTable("street_codes", {
	id: serial("id").primaryKey(),
	code: integer("code").notNull().unique(),
	name_concatenated: text("name_concatenated").notNull(),
	official_name: text("official_name").notNull(),
	short_name: text("short_name").notNull(),
	pavement_code: text("pavement_code"),
	pavement_description: text("pavement_description"),
	created_at: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

// ============================================================================
// Traffic Violations Catalog Schema
// Canonical registry of violation codes + descriptions with categories
// ============================================================================

export const trafficViolationsCatalog = pgTable("traffic_violations_catalog", {
	id: serial("id").primaryKey(),
	law_code: text("law_code").notNull(),
	canonical_description: text("canonical_description").notNull(),
	known_variants: text("known_variants").array().notNull().default(sql`'{}'`),
	category: text("category").notNull(),
	differentiation: text("differentiation"),
	created_at: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
}, (table) => [
	index("idx_tvc_category").on(table.category),
	index("idx_tvc_variants").on(table.known_variants),
]);

// ============================================================================
// TrafficViolations Schema
// ============================================================================

export const trafficViolations = pgTable("traffic_violations", {
	id: serial("id").primaryKey(),
	violation_date: timestamp("violation_date", { withTimezone: true }).notNull(),
	agent_id: integer("agent_id").notNull(),
	location_id: integer("location_id").notNull(),
	cttu_code: text("cttu_code").notNull(),
	law_code: text("law_code").notNull(),
	description: text("description").notNull(),
	location_description: text("location_description").notNull(),
	street_code: integer("street_code").references(() => streetCodes.code),
	violation_id: integer("violation_id").references(() => trafficViolationsCatalog.id),
	created_at: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

// ============================================================================
// Violation Categories Schema
// Maps violation codes to editorial categories (frontend-driven classification)
// ============================================================================

export const violationCategories = pgTable("violation_categories", {
	id: serial("id").primaryKey(),
	cttu_code: text("cttu_code").notNull(),
	law_code: text("law_code").notNull(),
	description_keyword: text("description_keyword"),
	category: text("category").notNull(),
	created_at: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
}, (table) => [
	index("idx_vc_code").on(table.cttu_code),
	index("idx_vc_category").on(table.category),
]);

// ============================================================================
// Description Corrections Schema
// Maps original (encoding-broken) descriptions to corrected ones.
// Applied during seed — updates traffic_violations.description in place.
// ============================================================================

export const descriptionCorrections = pgTable("description_corrections", {
	id: serial("id").primaryKey(),
	cttu_code: text("cttu_code").notNull(),
	original_description: text("original_description").notNull(),
	corrected_description: text("corrected_description").notNull(),
	applied: boolean("applied").default(false),
	created_at: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
}, (table) => [
	index("idx_dc_code").on(table.cttu_code),
	index("idx_dc_applied").on(table.applied),
	unique("uq_dc_code_desc").on(table.cttu_code, table.original_description),
]);

// ============================================================================
// Traffic Violations Locations Schema
// Canonical registry of unique violation location descriptions.
// Replaces dict_locais_v2.json — one row per unique raw location text.
// ============================================================================

export const trafficViolationsLocations = pgTable(
	"traffic_violations_locations",
	{
		id: serial("id").primaryKey(),
		location_id: integer("location_id").notNull().unique(),
		raw_description: text("raw_description").notNull(),
		extracted_street: text("extracted_street"),
		street_type: text("street_type"),
		semaphore_number: text("semaphore_number"),
		address_number: text("address_number"),
		reference_point: text("reference_point"),
		direction: text("direction"),
		is_new: boolean("is_new").default(false),
		source_year: integer("source_year"),
		created_at: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("idx_tvl_location_id").on(table.location_id),
		index("idx_tvl_is_new").on(table.is_new),
		index("idx_tvl_semaphore").on(table.semaphore_number),
	],
);

// ============================================================================
// Traffic Equipment Schema
// Fiscalization and monitoring equipment from Recife city data portal.
// Used to match violation locations that reference known equipment.
// ============================================================================

export const trafficEquipment = pgTable(
	"traffic_equipment",
	{
		id: serial("id").primaryKey(),
		equipment_type: text("equipment_type").notNull(),
		identification: text("identification"),
		local_instalacao: text("local_instalacao"),
		latitude: text("latitude"),
		longitude: text("longitude"),
		sentido: text("sentido"),
		street_code: integer("street_code").references(() => streetCodes.code),
		extra_data: jsonb("extra_data"),
		source_file: text("source_file"),
		created_at: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("idx_te_type").on(table.equipment_type),
		index("idx_te_identification").on(table.identification),
		index("idx_te_street_code").on(table.street_code),
	],
);

// ============================================================================
// Location / Street Matches Schema
// Stores the result of matching location descriptions to official streets
// ============================================================================

export const locationStreetMatches = pgTable(
	"location_street_matches",
	{
		id: serial("id").primaryKey(),
		location_id: integer("location_id").notNull().unique(),
		location_description: text("location_description").notNull(),
		extracted_street_name: text("extracted_street_name"),
		extracted_street_type: text("extracted_street_type"),
		semaphore_number: text("semaphore_number"),
		address_number: text("address_number"),
		matched_street_code: integer("matched_street_code").references(
			() => streetCodes.code,
		),
		match_method: text("match_method"),
		match_confidence: numeric("match_confidence"),
		alternative_candidates: jsonb("alternative_candidates"),
		needs_validation: boolean("needs_validation").default(false),
		validated_by: text("validated_by"),
		validated_at: timestamp("validated_at", { withTimezone: true }),
		validation_status: text("validation_status"), // pending, confirmed, rejected
		normalized_data: jsonb("normalized_data"),
		is_new: boolean("is_new").default(false),
		created_by: text("created_by"),
		created_at: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("idx_lsm_location_id").on(table.location_id),
		index("idx_lsm_matched_street").on(table.matched_street_code),
		index("idx_lsm_needs_validation").on(table.needs_validation),
		index("idx_lsm_match_method").on(table.match_method),
		index("idx_lsm_is_new").on(table.is_new),
	],
);

// ============================================================================
// Relations
// ============================================================================

export const streetCodesRelations = relations(
	streetCodes,
	({ many }) => ({
		trafficViolations: many(trafficViolations),
		locationStreetMatches: many(locationStreetMatches),
		trafficEquipment: many(trafficEquipment),
	}),
);

export const trafficViolationsRelations = relations(
	trafficViolations,
	({ one }) => ({
		street: one(streetCodes, {
			fields: [trafficViolations.street_code],
			references: [streetCodes.code],
		}),
		catalog: one(trafficViolationsCatalog, {
			fields: [trafficViolations.violation_id],
			references: [trafficViolationsCatalog.id],
		}),
	}),
);

export const trafficViolationsLocationsRelations = relations(
	trafficViolationsLocations,
	({ one }) => ({
		match: one(locationStreetMatches, {
			fields: [trafficViolationsLocations.location_id],
			references: [locationStreetMatches.location_id],
		}),
	}),
);

export const locationStreetMatchesRelations = relations(
	locationStreetMatches,
	({ one }) => ({
		street: one(streetCodes, {
			fields: [locationStreetMatches.matched_street_code],
			references: [streetCodes.code],
		}),
	}),
);

// ============================================================================
// Zod Schemas
// ============================================================================

export const insertStreetCodeSchema = createInsertSchema(streetCodes, {
	code: z.number().int().positive(),
	name_concatenated: z.string().min(1),
	official_name: z.string().min(1),
	short_name: z.string().min(1),
	pavement_code: z.string().optional(),
	pavement_description: z.string().optional(),
});

export const selectStreetCodeSchema = createSelectSchema(streetCodes);

export const insertTrafficViolationSchema = createInsertSchema(
	trafficViolations,
	{
		violation_date: z.coerce.date(),
		agent_id: z.number().int().positive(),
		location_id: z.number().int().positive(),
		cttu_code: z.string().min(1),
		law_code: z.string().min(1),
		description: z.string().min(1),
		location_description: z.string().min(1),
		street_code: z.number().int().optional(),
		violation_id: z.number().int().optional(),
	},
);

export const selectTrafficViolationSchema =
	createSelectSchema(trafficViolations);

export const insertLocationStreetMatchSchema = createInsertSchema(
	locationStreetMatches,
	{
		location_id: z.number().int().positive(),
		location_description: z.string().min(1),
		extracted_street_name: z.string().optional(),
		extracted_street_type: z.string().optional(),
		semaphore_number: z.string().optional(),
		address_number: z.string().optional(),
		matched_street_code: z.number().int().optional(),
		match_method: z.string().optional(),
		match_confidence: z.number().optional(),
		alternative_candidates: z.record(z.any()).optional(),
		needs_validation: z.boolean().optional(),
		validated_by: z.string().optional(),
		validated_at: z.coerce.date().optional(),
		validation_status: z.string().optional(),
		normalized_data: z.record(z.any()).optional(),
		is_new: z.boolean().optional(),
		created_by: z.string().optional(),
	},
);

export const selectLocationStreetMatchSchema = createSelectSchema(
	locationStreetMatches,
);

export const insertViolationCategorySchema = createInsertSchema(
	violationCategories,
	{
		cttu_code: z.string().min(1),
		law_code: z.string().min(1),
		description_keyword: z.string().optional(),
		category: z.string().min(1),
	},
);

export const selectViolationCategorySchema = createSelectSchema(
	violationCategories,
);

export const insertDescriptionCorrectionSchema = createInsertSchema(
	descriptionCorrections,
	{
		cttu_code: z.string().min(1),
		original_description: z.string().min(1),
		corrected_description: z.string().min(1),
		applied: z.boolean().optional(),
	},
);

export const selectDescriptionCorrectionSchema = createSelectSchema(
	descriptionCorrections,
);

export const insertTrafficViolationsLocationSchema = createInsertSchema(
	trafficViolationsLocations,
	{
		location_id: z.number().int().positive(),
		raw_description: z.string().min(1),
		extracted_street: z.string().optional(),
		street_type: z.string().optional(),
		semaphore_number: z.string().optional(),
		address_number: z.string().optional(),
		reference_point: z.string().optional(),
		direction: z.string().optional(),
		is_new: z.boolean().optional(),
		source_year: z.number().int().optional(),
	},
);

export const selectTrafficViolationsLocationSchema = createSelectSchema(
	trafficViolationsLocations,
);

export const insertTrafficEquipmentSchema = createInsertSchema(
	trafficEquipment,
	{
		equipment_type: z.string().min(1),
		identification: z.string().optional(),
		local_instalacao: z.string().optional(),
		latitude: z.string().optional(),
		longitude: z.string().optional(),
		sentido: z.string().optional(),
		street_code: z.number().int().optional(),
		extra_data: z.record(z.any()).optional(),
		source_file: z.string().optional(),
	},
);

export const selectTrafficEquipmentSchema = createSelectSchema(
	trafficEquipment,
);

// ============================================================================
// TypeScript Types
// ============================================================================

export type StreetCode = typeof streetCodes.$inferSelect;
export type NewStreetCode = typeof streetCodes.$inferInsert;
export type StreetCodeInsert = z.infer<typeof insertStreetCodeSchema>;
export type StreetCodeSelect = z.infer<typeof selectStreetCodeSchema>;

export type TrafficViolation = typeof trafficViolations.$inferSelect;
export type NewTrafficViolation = typeof trafficViolations.$inferInsert;
export type TrafficViolationInsert = z.infer<
	typeof insertTrafficViolationSchema
>;
export type TrafficViolationSelect = z.infer<
	typeof selectTrafficViolationSchema
>;

export type TrafficViolationsCatalog = typeof trafficViolationsCatalog.$inferSelect;
export type NewTrafficViolationsCatalog = typeof trafficViolationsCatalog.$inferInsert;

export type LocationStreetMatch = typeof locationStreetMatches.$inferSelect;
export type NewLocationStreetMatch = typeof locationStreetMatches.$inferInsert;
export type LocationStreetMatchInsert = z.infer<
	typeof insertLocationStreetMatchSchema
>;
export type LocationStreetMatchSelect = z.infer<
	typeof selectLocationStreetMatchSchema
>;

export type ViolationCategory = typeof violationCategories.$inferSelect;
export type NewViolationCategory = typeof violationCategories.$inferInsert;
export type ViolationCategoryInsert = z.infer<typeof insertViolationCategorySchema>;
export type ViolationCategorySelect = z.infer<typeof selectViolationCategorySchema>;

export type DescriptionCorrection = typeof descriptionCorrections.$inferSelect;
export type NewDescriptionCorrection = typeof descriptionCorrections.$inferInsert;
export type DescriptionCorrectionInsert = z.infer<typeof insertDescriptionCorrectionSchema>;
export type DescriptionCorrectionSelect = z.infer<typeof selectDescriptionCorrectionSchema>;

export type TrafficViolationsLocation = typeof trafficViolationsLocations.$inferSelect;
export type NewTrafficViolationsLocation = typeof trafficViolationsLocations.$inferInsert;
export type TrafficViolationsLocationInsert = z.infer<typeof insertTrafficViolationsLocationSchema>;
export type TrafficViolationsLocationSelect = z.infer<typeof selectTrafficViolationsLocationSchema>;

export type TrafficEquipment = typeof trafficEquipment.$inferSelect;
export type NewTrafficEquipment = typeof trafficEquipment.$inferInsert;
export type TrafficEquipmentInsert = z.infer<typeof insertTrafficEquipmentSchema>;
export type TrafficEquipmentSelect = z.infer<typeof selectTrafficEquipmentSchema>;
