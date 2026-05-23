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
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// Official Streets (Logradouros) Schema
// ============================================================================

export const officialStreets = pgTable("official_streets", {
	id: serial("id").primaryKey(),
	code: integer("code").notNull().unique(),
	name_concatenated: text("name_concatenated").notNull(),
	official_name: text("official_name").notNull(),
	short_name: text("short_name").notNull(),
	pavement_code: text("pavement_code"),
	pavement_description: text("pavement_description"),
	transport_corridor: boolean("transport_corridor").default(false),
	perimeter_road: boolean("perimeter_road").default(false),
	neighborhood_code: integer("neighborhood_code"),
	neighborhood_name: text("neighborhood_name"),
	created_at: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

// ============================================================================
// TrafficViolations Schema
// ============================================================================

export const trafficViolations = pgTable("traffic_violations", {
	id: serial("id").primaryKey(),
	violation_date: timestamp("violation_date", { withTimezone: true }).notNull(),
	agent_id: integer("agent_id").notNull(),
	violation_type_id: integer("violation_type_id").notNull(),
	location_id: integer("location_id").notNull(),
	violation_code: text("violation_code").notNull(),
	law_code: text("law_code").notNull(),
	description: text("description").notNull(),
	location_description: text("location_description").notNull(),
	coordinates: text("coordinates"),
	street_code: integer("street_code").references(() => officialStreets.code),
	complementary_data: jsonb("complementary_data"),
	created_at: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

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
			() => officialStreets.code,
		),
		match_method: text("match_method"),
		match_confidence: numeric("match_confidence"),
		alternative_candidates: jsonb("alternative_candidates"),
		needs_validation: boolean("needs_validation").default(false),
		validated_by: text("validated_by"),
		validated_at: timestamp("validated_at", { withTimezone: true }),
		validation_status: text("validation_status"), // pending, confirmed, rejected
		normalized_data: jsonb("normalized_data"),
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
	],
);

// ============================================================================
// Relations
// ============================================================================

export const officialStreetsRelations = relations(
	officialStreets,
	({ many }) => ({
		trafficViolations: many(trafficViolations),
		locationStreetMatches: many(locationStreetMatches),
	}),
);

export const trafficViolationsRelations = relations(
	trafficViolations,
	({ one }) => ({
		street: one(officialStreets, {
			fields: [trafficViolations.street_code],
			references: [officialStreets.code],
		}),
	}),
);

export const locationStreetMatchesRelations = relations(
	locationStreetMatches,
	({ one }) => ({
		street: one(officialStreets, {
			fields: [locationStreetMatches.matched_street_code],
			references: [officialStreets.code],
		}),
	}),
);

// ============================================================================
// Zod Schemas
// ============================================================================

export const insertOfficialStreetSchema = createInsertSchema(officialStreets, {
	code: z.number().int().positive(),
	name_concatenated: z.string().min(1),
	official_name: z.string().min(1),
	short_name: z.string().min(1),
	pavement_code: z.string().optional(),
	pavement_description: z.string().optional(),
	transport_corridor: z.boolean().optional(),
	perimeter_road: z.boolean().optional(),
	neighborhood_code: z.number().int().optional(),
	neighborhood_name: z.string().optional(),
});

export const selectOfficialStreetSchema = createSelectSchema(officialStreets);

export const insertTrafficViolationSchema = createInsertSchema(
	trafficViolations,
	{
		violation_date: z.coerce.date(),
		agent_id: z.number().int().positive(),
		violation_type_id: z.number().int().positive(),
		location_id: z.number().int().positive(),
		violation_code: z.string().min(1),
		law_code: z.string().min(1),
		description: z.string().min(1),
		location_description: z.string().min(1),
		coordinates: z.string().optional(),
		street_code: z.number().int().optional(),
		complementary_data: z.record(z.any()).optional(),
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
	},
);

export const selectLocationStreetMatchSchema = createSelectSchema(
	locationStreetMatches,
);

// ============================================================================
// TypeScript Types
// ============================================================================

export type OfficialStreet = typeof officialStreets.$inferSelect;
export type NewOfficialStreet = typeof officialStreets.$inferInsert;
export type OfficialStreetInsert = z.infer<typeof insertOfficialStreetSchema>;
export type OfficialStreetSelect = z.infer<typeof selectOfficialStreetSchema>;

export type TrafficViolation = typeof trafficViolations.$inferSelect;
export type NewTrafficViolation = typeof trafficViolations.$inferInsert;
export type TrafficViolationInsert = z.infer<
	typeof insertTrafficViolationSchema
>;
export type TrafficViolationSelect = z.infer<
	typeof selectTrafficViolationSchema
>;

export type LocationStreetMatch = typeof locationStreetMatches.$inferSelect;
export type NewLocationStreetMatch = typeof locationStreetMatches.$inferInsert;
export type LocationStreetMatchInsert = z.infer<
	typeof insertLocationStreetMatchSchema
>;
export type LocationStreetMatchSelect = z.infer<
	typeof selectLocationStreetMatchSchema
>;
