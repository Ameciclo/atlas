import { config } from "dotenv";
config({ path: "../../.env" });
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

export const db = drizzle({
	connection: {
		connectionString: process.env.DATABASE_URL,
		ssl: false, // Disable SSL for local development
	},
	schema,
});
