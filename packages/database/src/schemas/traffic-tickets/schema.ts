import {
	integer,
	pgTable,
	serial,
	text,
	timestamp,
	boolean,
	index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// Official Streets Schema (deduped version of pcr_streets — one row per unique code)
// ============================================================================

export const officialStreets = pgTable("official_streets", {
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
// Traffic Tickets Catalog Schema
// Canonical registry of violation codes + descriptions with categories
// ============================================================================

export const trafficTicketsCatalog = pgTable(
	"traffic_tickets_catalog",
	{
		id: serial("id").primaryKey(),
		law_code: text("law_code").notNull(),
		canonical_description: text("canonical_description").notNull(),
		known_variants: text("known_variants").array().notNull().default(sql`'{}'`),
		category: text("category").notNull(),
		differentiation: text("differentiation"),
		created_at: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("idx_ttc_category").on(table.category),
		index("idx_ttc_variants").on(table.known_variants),
	],
);

// ============================================================================
// Traffic Tickets Schema
// ============================================================================

export const trafficTickets = pgTable("traffic_tickets", {
	id: serial("id").primaryKey(),
	violation_date: timestamp("violation_date", { withTimezone: true }).notNull(),
	agent_id: integer("agent_id").notNull(),
	location_id: integer("location_id")
		.notNull()
		.references(() => trafficTicketsLocations.location_id),
	cttu_code: text("cttu_code").notNull(),
	violation_id: integer("violation_id").references(
		() => trafficTicketsCatalog.id,
	),
	created_at: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

// ============================================================================
// Traffic Tickets Locations Schema
// Canonical registry of unique violation location descriptions.
// ============================================================================

export const trafficTicketsLocations = pgTable(
	"traffic_tickets_locations",
	{
		id: serial("id").primaryKey(),
		location_id: integer("location_id").notNull().unique(),
		raw_description: text("raw_description").notNull(),
		extracted_street: text("extracted_street"),
		street_type: text("street_type"),
		street_code: integer("street_code").references(() => officialStreets.code),
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
		index("idx_ttl_location_id").on(table.location_id),
		index("idx_ttl_is_new").on(table.is_new),
		index("idx_ttl_semaphore").on(table.semaphore_number),
		index("idx_ttl_street_code").on(table.street_code),
	],
);

// ============================================================================
// Relations
// ============================================================================

export const officialStreetsRelations = relations(
	officialStreets,
	({ many }) => ({
		locations: many(trafficTicketsLocations),
	}),
);

export const trafficTicketsRelations = relations(trafficTickets, ({ one }) => ({
	catalog: one(trafficTicketsCatalog, {
		fields: [trafficTickets.violation_id],
		references: [trafficTicketsCatalog.id],
	}),
}));

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
});

export const selectOfficialStreetSchema = createSelectSchema(officialStreets);

export const insertTrafficTicketSchema = createInsertSchema(trafficTickets, {
	violation_date: z.coerce.date(),
	agent_id: z.number().int().positive(),
	location_id: z.number().int().positive(),
	cttu_code: z.string().min(1),
	violation_id: z.number().int().optional(),
});

export const selectTrafficTicketSchema = createSelectSchema(trafficTickets);

export const insertTrafficTicketsLocationSchema = createInsertSchema(
	trafficTicketsLocations,
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

export const selectTrafficTicketsLocationSchema = createSelectSchema(
	trafficTicketsLocations,
);

// ============================================================================
// TypeScript Types
// ============================================================================

export type OfficialStreet = typeof officialStreets.$inferSelect;
export type NewOfficialStreet = typeof officialStreets.$inferInsert;
export type OfficialStreetInsert = z.infer<typeof insertOfficialStreetSchema>;
export type OfficialStreetSelect = z.infer<typeof selectOfficialStreetSchema>;

export type TrafficTicket = typeof trafficTickets.$inferSelect;
export type NewTrafficTicket = typeof trafficTickets.$inferInsert;
export type TrafficTicketInsert = z.infer<typeof insertTrafficTicketSchema>;
export type TrafficTicketSelect = z.infer<typeof selectTrafficTicketSchema>;

export type TrafficTicketsCatalog = typeof trafficTicketsCatalog.$inferSelect;
export type NewTrafficTicketsCatalog =
	typeof trafficTicketsCatalog.$inferInsert;

export type TrafficTicketsLocation =
	typeof trafficTicketsLocations.$inferSelect;
export type NewTrafficTicketsLocation =
	typeof trafficTicketsLocations.$inferInsert;
export type TrafficTicketsLocationInsert = z.infer<
	typeof insertTrafficTicketsLocationSchema
>;
export type TrafficTicketsLocationSelect = z.infer<
	typeof selectTrafficTicketsLocationSchema
>;
