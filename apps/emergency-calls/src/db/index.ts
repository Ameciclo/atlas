import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";

const { Client } = pkg;

import * as schema from "@atlas/database/schemas/emergency-calls";

const client = new Client({
	connectionString: process.env.DATABASE_URL,
	ssl: false, // Disable SSL for local development
});

await client.connect();

export const db = drizzle(client, { schema });
