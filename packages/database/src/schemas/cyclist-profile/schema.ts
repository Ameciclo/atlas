import { jsonb, serial, timestamp } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { schemaManager } from "../../schema-manager.js";

// Get the cyclist_profile schema
const cyclistProfileSchema = schemaManager.getSchema("cyclist-profile");

export const cyclistProfiles = cyclistProfileSchema.table("cyclist_profiles", {
	id: serial("id").primaryKey(),
	data: jsonb("data").notNull(),
	metadata: jsonb("metadata").notNull(),
	created_at: timestamp("created_at").defaultNow().notNull(),
	updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const selectCyclistProfileSchema = createSelectSchema(cyclistProfiles);

export type CyclistProfile = typeof cyclistProfiles.$inferSelect;
export type NewCyclistProfile = typeof cyclistProfiles.$inferInsert;
