import {
	integer,
	pgTable,
	serial,
	text,
	timestamp,
	jsonb,
	boolean,
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
// Relations
// ============================================================================

export const officialStreetsRelations = relations(officialStreets, ({ many }) => ({
	trafficViolations: many(trafficViolations),
}));

export const trafficViolationsRelations = relations(trafficViolations, ({ one }) => ({
	street: one(officialStreets, {
		fields: [trafficViolations.street_code],
		references: [officialStreets.code],
	}),
}));

// ============================================================================
// Zod Schemas
// ============================================================================

export const insertOfficialStreetSchema = createInsertSchema(
	officialStreets,
	{
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
	},
);

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
