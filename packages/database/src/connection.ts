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
 */
function getSSLConfig():
	| boolean
	| { rejectUnauthorized: boolean; ca?: string } {
	// If DATABASE_URL contains sslmode=require, enable SSL
	const databaseUrl = process.env.DATABASE_URL || "";
	const urlHasSSL = databaseUrl.includes("sslmode=require");

	// Check if SSL is explicitly enabled
	const sslEnabled = process.env.DB_SSL === "true" || urlHasSSL;

	if (!sslEnabled) {
		return false;
	}

	// If DATABASE_SSL_CA is provided, use it for certificate validation
	if (process.env.DATABASE_SSL_CA) {
		try {
			const ca = readFileSync(process.env.DATABASE_SSL_CA, "utf-8");
			return {
				rejectUnauthorized: true,
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

	// Default: SSL enabled but don't validate certificate (for self-signed certs)
	return { rejectUnauthorized: false };
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
