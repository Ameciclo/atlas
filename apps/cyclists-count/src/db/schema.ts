import { geometry, index, integer, jsonb, pgTable, timestamp } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";

export const cyclistsCounts = pgTable(
	"cyclists_counts",
	{
		id: integer("id").primaryKey(),
		data: jsonb("data").notNull(),
		metadata: jsonb("metadata").notNull(),
		coordinates: geometry("coordinates", { type: "point", mode: "xy", srid: 4326 }),
		created_at: timestamp("created_at").defaultNow().notNull(),
		updated_at: timestamp("updated_at").defaultNow().notNull(),
	},
	(t) => [
		index("spatial_index").using("gist", t.coordinates),
	]
);

export const selectCyclistsCountSchema = createSelectSchema(cyclistsCounts);

export type CyclistsCount = typeof cyclistsCounts.$inferSelect;
