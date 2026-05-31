import { config } from "dotenv";

config({ path: "../../.env" });

import * as schema from "@atlas/database/schemas/traffic-violations";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	ssl: false,
});

export const db = drizzle(pool, { schema });

export async function ensureConnection() {
	try {
		await pool.query("SELECT 1");
	} catch {
		// pool handles reconnection automatically
	}
}
