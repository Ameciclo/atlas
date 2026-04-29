import { jsonb, pgTable, serial, timestamp, text } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Table in the public schema
export const cyclistProfiles = pgTable("cyclist_profiles", {
	id: serial("id").primaryKey(),
	data: jsonb("data").notNull(),
	metadata: jsonb("metadata").notNull(),
	coordinates: text("coordinates"), // PostGIS geometry(Point, 4326) - managed via custom migration
	created_at: timestamp("created_at").defaultNow().notNull(),
	updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const selectCyclistProfileSchema = createSelectSchema(cyclistProfiles, {
	coordinates: z.any().optional(), // PostGIS geometry - skip validation
});

export type CyclistProfile = typeof cyclistProfiles.$inferSelect;
export type NewCyclistProfile = typeof cyclistProfiles.$inferInsert;
