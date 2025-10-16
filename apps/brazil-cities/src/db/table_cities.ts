import { varchar, integer, boolean } from "drizzle-orm/pg-core";
import { global } from "./schema_global";

export const cities = global.table("cities", {
  id: integer("id").primaryKey(),
  name: varchar("name").notNull(),
  state: varchar("state", { length: 2 }).notNull(),
  full_state: varchar("full_state").notNull(),
  rmr: boolean("rmr"),
});
