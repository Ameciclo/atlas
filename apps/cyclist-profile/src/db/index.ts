import "dotenv/config";
import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";

const { Client } = pkg;

import * as schema from "@atlas/database/schemas/cyclist-profile";

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

const client = new Client({
	connectionString: process.env.DATABASE_URL,
	ssl: getSSLConfig(),
});

await client.connect();

export const db = drizzle(client, { schema });
