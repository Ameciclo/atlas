import { config } from "dotenv";
config({ path: "../../.env" });
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { getSSLConfig } from "@atlas/database";
import * as schema from "@atlas/database/schemas/emergency-calls";

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	ssl: getSSLConfig(),
});

export const db = drizzle(pool, { schema });
