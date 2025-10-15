import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import type { Client as PgClient } from "pg";

const { Client } = pg;

export interface DatabaseConfig {
	connectionString?: string;
	host?: string;
	port?: number;
	user?: string;
	password?: string;
	database?: string;
	ssl?: boolean;
	schema?: Record<string, unknown>;
}

export interface AtlasDatabase extends NodePgDatabase<Record<string, unknown>> {
	client: PgClient;
}

/**
 * Creates a database connection with the provided configuration
 * Falls back to environment variables if config is not provided
 */
export function createDatabase(config: DatabaseConfig = {}): AtlasDatabase {
	const connectionString =
		config.connectionString ||
		process.env.DATABASE_URL ||
		`postgres://${config.user || process.env.DB_USER || "postgres"}:${
			config.password || process.env.DB_PASSWORD || "postgres"
		}@${config.host || process.env.DB_HOST || "localhost"}:${
			config.port || Number.parseInt(process.env.DB_PORT || "5432")
		}/${config.database || process.env.DB_NAME || "atlas"}`;

	const client = new Client({
		connectionString,
		ssl:
			config.ssl !== undefined
				? config.ssl
				: process.env.DB_SSL === "true"
					? { rejectUnauthorized: false }
					: false,
	});

	const db = drizzle(client, {
		schema: config.schema || {},
	});

	// Create the AtlasDatabase with the client attached
	const atlasDb = db as unknown as AtlasDatabase;
	atlasDb.client = client;

	return atlasDb;
}

/**
 * Creates a database connection and automatically connects
 */
export async function createConnectedDatabase(
	config: DatabaseConfig = {},
): Promise<AtlasDatabase> {
	const db = createDatabase(config);
	await db.client.connect();
	return db;
}

/**
 * Closes the database connection
 */
export async function closeDatabase(db: AtlasDatabase): Promise<void> {
	await db.client.end();
}
