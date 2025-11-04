import { config } from "dotenv";
config({ path: "../../.env" });
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";

const { Client } = pkg;

import { getSSLConfig } from "@atlas/database";
import * as schema from "@atlas/database/schemas/traffic-violations";

const client = new Client({
	connectionString: process.env.DATABASE_URL,
	ssl: false, // Disable SSL for local development
});

let connected = false;















































export const db = drizzle(client, { schema });

export async function ensureConnection() {
	if (!connected) {
		await client.connect();
		connected = true;
	}
}
