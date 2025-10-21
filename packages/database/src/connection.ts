import "dotenv/config";
import { readFileSync } from "node:fs";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Client as PgClient } from "pg";
import pg from "pg";

const { Client } = pg;

export interface DatabaseConfig {
	connectionString?: string;
	host?: string;
	port?: number;
	user?: string;
	password?: string;
	database?: string;
	ssl?: boolean | { rejectUnauthorized?: boolean; ca?: string };
	schema?: Record<string, unknown>;
}

export interface AtlasDatabase extends NodePgDatabase<Record<string, unknown>> {
	client: PgClient;
}

/**
 * Get SSL configuration from environment variables
 *
 * SSL is enabled when DATABASE_SSL_CA is provided.
 * The CA certificate is read from the file path and used for encryption.
 *
 * Note: rejectUnauthorized is set to false to support managed databases
 * like Digital Ocean that may use self-signed certificates in the chain.
 *
 * @returns SSL configuration object or false if SSL is disabled
 */
export function getSSLConfig():
	| false
	| { rejectUnauthorized: boolean; ca?: string } {
	// If DATABASE_SSL_CA is provided, enable SSL with CA certificate
	if (process.env.DATABASE_SSL_CA) {
		try {
			const ca = readFileSync(process.env.DATABASE_SSL_CA, "utf8");
			return {
				// Set to false to accept self-signed certificates (common in managed databases)
				rejectUnauthorized: false,
				ca,
			};
		} catch (error) {
			console.warn(
				`Failed to read SSL CA certificate from ${process.env.DATABASE_SSL_CA}:`,
				error,
			);
			// Fall back to basic SSL without CA validation
			return { rejectUnauthorized: false };
		}
	}

	// No SSL if DATABASE_SSL_CA is not provided
	return false;
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
			config.port || Number.parseInt(process.env.DB_PORT || "5432", 10)
		}/${config.database || process.env.DB_NAME || "atlas_dev"}`;

	const client = new Client({
		connectionString,
		ssl: config.ssl !== undefined ? config.ssl : getSSLConfig(),
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
