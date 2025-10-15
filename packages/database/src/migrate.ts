import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { closeDatabase, createConnectedDatabase } from "./connection.js";
import type { DatabaseConfig } from "./connection.js";
import { schemaManager } from "./schema-manager.js";

export interface MigrationConfig extends DatabaseConfig {
	migrationsFolder?: string;
	serviceName?: string;
}

/**
 * Run migrations for the entire database or a specific service
 */
export async function runMigrations(
	config: MigrationConfig = {},
): Promise<void> {
	const db = await createConnectedDatabase(config);

	try {
		console.log("🔄 Connecting to database...");

		// Create all registered schemas first
		await schemaManager.createSchemas(db);

		const migrationsFolder =
			config.migrationsFolder ||
			process.env.MIGRATIONS_FOLDER ||
			"./src/migrations";

		console.log(`🔄 Running migrations from ${migrationsFolder}...`);

		await migrate(db, {
			migrationsFolder,
		});

		console.log("✅ Migrations completed successfully!");
	} catch (error) {
		console.error("❌ Error running migrations:", error);
		throw error;
	} finally {
		await closeDatabase(db);
	}
}

/**
 * CLI entry point for running migrations
 */
if (import.meta.url === `file://${process.argv[1]}`) {
	const serviceName = process.argv[2];
	const migrationsFolder = process.argv[3];

	runMigrations({
		serviceName,
		migrationsFolder,
	}).catch((error) => {
		console.error("Migration failed:", error);
		process.exit(1);
	});
}
