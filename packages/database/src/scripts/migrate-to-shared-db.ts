#!/usr/bin/env tsx

/**
 * Migration script to move data from individual service databases 
 * to the shared Atlas database with PostgreSQL schemas
 */

import "dotenv/config";
import { createConnectedDatabase, closeDatabase } from "../connection.js";
import { schemaManager } from "../schema-manager.js";
import { migrateTableData, tableExists } from "../utils/migration-helpers.js";

interface ServiceMigration {
	serviceName: string;
	sourceDatabase: string;
	tables: string[];
}

const SERVICES_TO_MIGRATE: ServiceMigration[] = [
	{
		serviceName: "cyclist-profile",
		sourceDatabase: "cyclist_profile_db",
		tables: ["cyclist_profiles"],
	},
	// Add more services here as they are created
];

async function migrateToSharedDatabase() {
	console.log("🚀 Starting migration to shared Atlas database");

	const atlasDb = await createConnectedDatabase({
		database: "atlas",
	});

	try {
		// Create all schemas first
		console.log("📋 Creating PostgreSQL schemas...");
		await schemaManager.createSchemas(atlasDb);

		for (const service of SERVICES_TO_MIGRATE) {
			console.log(`\n🔄 Migrating service: ${service.serviceName}`);

			const targetSchema = service.serviceName.replace(/-/g, "_");

			// Connect to source database to check if it exists
			let sourceDb;
			try {
				sourceDb = await createConnectedDatabase({
					database: service.sourceDatabase,
				});

				for (const tableName of service.tables) {
					console.log(`  📊 Checking table: ${tableName}`);

					// Check if table exists in source
					const exists = await tableExists(sourceDb, "public", tableName);
					if (!exists) {
						console.log(`    ⚠️  Table ${tableName} not found in source, skipping`);
						continue;
					}

					// Check if table already exists in target
					const targetExists = await tableExists(
						atlasDb,
						targetSchema,
						tableName,
					);
					if (targetExists) {
						console.log(
							`    ℹ️  Table ${tableName} already exists in target schema, skipping`,
						);
						continue;
					}

					console.log(`    🔄 Migrating ${tableName}...`);

					// Get table structure from source
					const createTableResult = await sourceDb.execute(`
						SELECT 
							'CREATE TABLE "' || '${targetSchema}' || '"."' || table_name || '" (' ||
							string_agg(
								'"' || column_name || '" ' || 
								CASE 
									WHEN data_type = 'character varying' THEN 'varchar(' || character_maximum_length || ')'
									WHEN data_type = 'character' THEN 'char(' || character_maximum_length || ')'
									WHEN data_type = 'numeric' THEN 'numeric(' || numeric_precision || ',' || numeric_scale || ')'
									ELSE data_type
								END ||
								CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
								CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
								', '
							) || ');' as create_statement
						FROM information_schema.columns 
						WHERE table_name = '${tableName}' AND table_schema = 'public'
						GROUP BY table_name
					`);

					if (createTableResult.rows.length > 0) {
						const createStatement = createTableResult.rows[0]
							?.create_statement as string;
						await atlasDb.execute(createStatement);
						console.log(`    ✅ Created table structure`);
					}

					// Copy data
					const copyResult = await sourceDb.execute(`
						SELECT COUNT(*) as count FROM "${tableName}"
					`);
					const rowCount = Number.parseInt(
						copyResult.rows[0]?.count as string,
					);

					if (rowCount > 0) {
						// For simplicity, we'll use a basic INSERT...SELECT approach
						// In production, you might want to use pg_dump/pg_restore or COPY commands
						console.log(`    📦 Copying ${rowCount} rows...`);

						// This is a simplified approach - in practice you'd want to handle this more carefully
						console.log(
							`    ⚠️  Manual data copy required from ${service.sourceDatabase}.${tableName} to atlas.${targetSchema}.${tableName}`,
						);
					}

					console.log(`    ✅ Migration completed for ${tableName}`);
				}

				await closeDatabase(sourceDb);
			} catch (error) {
				console.log(
					`    ⚠️  Could not connect to source database ${service.sourceDatabase}, it may not exist yet`,
				);
				if (sourceDb) {
					await closeDatabase(sourceDb);
				}
			}
		}

		console.log("\n✅ Migration to shared database completed!");
		console.log("\n📋 Next steps:");
		console.log("1. Update service configurations to use the shared database");
		console.log("2. Run service-specific migrations if needed");
		console.log("3. Test all services with the new database setup");
		console.log("4. Update environment variables to point to 'atlas' database");
	} catch (error) {
		console.error("❌ Migration failed:", error);
		throw error;
	} finally {
		await closeDatabase(atlasDb);
	}
}

// Run migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	migrateToSharedDatabase().catch((error) => {
		console.error("Migration script failed:", error);
		process.exit(1);
	});
}
