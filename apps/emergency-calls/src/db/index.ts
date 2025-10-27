import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";

import * as schema from "@atlas/database/schemas/emergency-calls";

const client = new Client({
	connectionString: process.env.DATABASE_URL,
	ssl: false, // Disable SSL for local development
});

client.connect();

export const db = drizzle(client, { schema });
