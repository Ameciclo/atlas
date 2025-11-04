import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";

const { Client } = pkg;

import { getSSLConfig } from "@atlas/database";
import * as schema from "@atlas/database/schemas/cyclist-profile";

let db: ReturnType<typeof drizzle>;

if (process.env.NODE_ENV === "test") {
	// In test environment, create a mock client that won't actually connect
	const client = {} as InstanceType<typeof Client>;
	db = drizzle(client, { schema });
} else {
	const client = new Client({
		connectionString: process.env.DATABASE_URL,
		ssl: getSSLConfig(),
	});
	
	// Connect asynchronously
	client.connect().catch(console.error);
	db = drizzle(client, { schema });
}

export { db };
