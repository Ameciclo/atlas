import { jsonb, pgTable, serial, timestamp } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";

export const cyclistProfiles = pgTable("cyclist_profiles", {
	id: serial("id").primaryKey(),
	data: jsonb("data").notNull(),
	metadata: jsonb("metadata").notNull(),
	created_at: timestamp("created_at").defaultNow().notNull(),
	updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const selectCyclistProfileSchema = createSelectSchema(cyclistProfiles);

export type CyclistProfile = typeof cyclistProfiles.$inferSelect;
