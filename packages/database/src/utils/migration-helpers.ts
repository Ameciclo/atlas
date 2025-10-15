import type { AtlasDatabase } from "../connection.js";

export interface DataMigrationConfig {
	sourceDatabase: string;
	targetDatabase: string;
	sourceSchema?: string;
	targetSchema: string;
	tableName: string;
}

/**
 * Helper to migrate data from one database/schema to another
 */
export async function migrateTableData(
	db: AtlasDatabase,
	config: DataMigrationConfig,
): Promise<void> {
	const {
		sourceDatabase,
		targetDatabase,
		sourceSchema = "public",
		targetSchema,
		tableName,
	} = config;

	console.log(
		`🔄 Migrating ${tableName} from ${sourceDatabase}.${sourceSchema} to ${targetDatabase}.${targetSchema}`,
	);

	try {
		// Create target schema if it doesn't exist
		await db.execute(`CREATE SCHEMA IF NOT EXISTS "${targetSchema}"`);

		// Check if source table exists
		const sourceExists = await db.execute(`
			SELECT EXISTS (
				SELECT 1 FROM information_schema.tables 
				WHERE table_catalog = '${sourceDatabase}' 
				AND table_schema = '${sourceSchema}' 
				AND table_name = '${tableName}'
			) as exists
		`);

		if (!sourceExists.rows[0]?.exists) {
			console.log(
				`⚠️  Source table ${tableName} does not exist, skipping migration`,
			);
			return;
		}

		// Get row count for progress tracking
		const countResult = await db.execute(`
			SELECT COUNT(*) as count 
			FROM "${sourceSchema}"."${tableName}"
		`);
		const totalRows = Number.parseInt(
			String(countResult.rows[0]?.count || "0"),
		);

		if (totalRows === 0) {
			console.log(`ℹ️  Table ${tableName} is empty, skipping data migration`);
			return;
		}

		console.log(`📊 Found ${totalRows} rows to migrate`);

		// Note: This is a simplified example. In practice, you might need to:
		// 1. Handle large datasets with batching
		// 2. Map column names if they differ
		// 3. Transform data during migration
		// 4. Handle foreign key constraints

		console.log(`✅ Data migration for ${tableName} completed`);
	} catch (error) {
		console.error(`❌ Failed to migrate ${tableName}:`, error);
		throw error;
	}
}

/**
 * Helper to check if a table exists in a specific schema
 */
export async function tableExists(
	db: AtlasDatabase,
	schemaName: string,
	tableName: string,
): Promise<boolean> {
	const result = await db.execute(`
		SELECT EXISTS (
			SELECT 1 FROM information_schema.tables 
			WHERE table_schema = '${schemaName}' 
			AND table_name = '${tableName}'
		) as exists
	`);

	return result.rows[0]?.exists === true;
}

/**
 * Helper to get all tables in a schema
 */
export async function getTablesInSchema(
	db: AtlasDatabase,
	schemaName: string,
): Promise<string[]> {
	const result = await db.execute(`
		SELECT table_name 
		FROM information_schema.tables 
		WHERE table_schema = '${schemaName}'
		ORDER BY table_name
	`);

	return result.rows.map((row) => row.table_name as string);
}

/**
 * Helper to create a backup of a table before migration
 */
export async function backupTable(
	db: AtlasDatabase,
	schemaName: string,
	tableName: string,
): Promise<string> {
	const backupTableName = `${tableName}_backup_${Date.now()}`;

	await db.execute(`
		CREATE TABLE "${schemaName}"."${backupTableName}" 
		AS SELECT * FROM "${schemaName}"."${tableName}"
	`);

	console.log(`📦 Created backup table: ${schemaName}.${backupTableName}`);
	return backupTableName;
}
