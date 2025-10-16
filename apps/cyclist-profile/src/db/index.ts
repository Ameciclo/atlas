import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Client } = pkg;
import * as schema from "@atlas/database/schemas/cyclist-profile";

let client: InstanceType<typeof Client> | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;

/**
 * Get or create database connection
 * This lazy initialization allows importing this module without connecting to the database
 */
export async function getDb() {
	if (!dbInstance) {
		if (!process.env.DATABASE_URL) {
			throw new Error("DATABASE_URL environment variable is not set");
		}

		client = new Client({
			connectionString: process.env.DATABASE_URL,
		});

		await client.connect();
		dbInstance = drizzle(client, { schema });
	}

	return dbInstance;
}

/**
 * Close database connection
 */
export async function closeDb() {
	if (client) {
		await client.end();
		client = null;
		dbInstance = null;
	}
}

// For backwards compatibility and convenience, export a db object
// that will throw an error if used before connection is established
// In test environment, we create a mock-friendly structure
const isTest = process.env.NODE_ENV === "test";

export const db = new Proxy(
	isTest
		? ({
				query: {
					cyclistProfiles: {
						findMany: () => Promise.resolve([]),
						findFirst: () => Promise.resolve(undefined),
					},
				},
			} as ReturnType<typeof drizzle>)
		: ({} as ReturnType<typeof drizzle>),
	{
		get(target, prop) {
			// In test mode, allow accessing properties for mocking
			if (isTest && prop in target) {
				return target[prop as keyof typeof target];
			}

			if (!dbInstance) {
				throw new Error(
					"Database not connected. Call getDb() first or use getDb() directly.",
				);
			}
			return dbInstance[prop as keyof typeof dbInstance];
		},
	},
);
