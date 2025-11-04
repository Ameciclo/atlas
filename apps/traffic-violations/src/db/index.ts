import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";

const { Client } = pkg;

import { getSSLConfig } from "@atlas/database";
import * as schema from "@atlas/database/schemas/traffic-violations";

const client = new Client({
	connectionString: process.env.DATABASE_URL,
	ssl: getSSLConfig(),
});

await client.connect();

export const db = drizzle(client, { schema });
