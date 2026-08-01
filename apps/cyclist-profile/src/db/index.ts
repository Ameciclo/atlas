import { config } from "dotenv";
config({ path: "../../.env" });
import { getSSLConfig } from "@atlas/database";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@atlas/database/schemas/cyclist-profile";

export const db = drizzle({
	connection: {
		connectionString: process.env.DATABASE_URL,
		ssl: getSSLConfig(),
	},
	schema,
});
