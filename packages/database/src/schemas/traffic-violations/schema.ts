import {
	integer,
	pgTable,
	serial,
	text,
	timestamp,
	jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

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
	complementary_data: jsonb("complementary_data"),
	created_at: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

// ============================================================================
// Zod Schemas
// ============================================================================

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
		complementary_data: z.record(z.any()).optional(),
	},
);

export const selectTrafficViolationSchema =
	createSelectSchema(trafficViolations);

// ============================================================================
// TypeScript Types
// ============================================================================

export type TrafficViolation = typeof trafficViolations.$inferSelect;
export type NewTrafficViolation = typeof trafficViolations.$inferInsert;
export type TrafficViolationInsert = z.infer<
	typeof insertTrafficViolationSchema
>;
export type TrafficViolationSelect = z.infer<
	typeof selectTrafficViolationSchema
>;
