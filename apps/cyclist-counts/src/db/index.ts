import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { getSSLConfig } from "@atlas/database";
import * as schema from "./schema.js";

export const db = drizzle({
	connection: {
		connectionString: process.env.DATABASE_URL,
		ssl: getSSLConfig(),
	},
	schema,
});
