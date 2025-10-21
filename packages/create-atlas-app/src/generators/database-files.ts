import path from "node:path";
import fs from "fs-extra";
import type { AppConfig } from "../create-app.js";

/**
 * Find the repository root by looking for pnpm-workspace.yaml
 */
function findRepoRoot(): string {
	let currentDir = process.cwd();

	// Try up to 5 levels up
	for (let i = 0; i < 5; i++) {
		const workspaceFile = path.join(currentDir, "pnpm-workspace.yaml");
		if (fs.existsSync(workspaceFile)) {
			return currentDir;
		}
		const parentDir = path.dirname(currentDir);
		if (parentDir === currentDir) {
			// Reached filesystem root
			break;
		}
		currentDir = parentDir;
	}

	// Fallback to process.cwd()
	return process.cwd();
}

import { toSnakeCase } from "../utils.js";

export async function generateDatabaseFiles(
	appPath: string,
	config: AppConfig,
) {
	const dbPath = path.join(appPath, "src", "db");
	await fs.ensureDir(dbPath);

	// Generate db/index.ts (connection only)
	await fs.writeFile(path.join(dbPath, "index.ts"), generateDbIndex(config));

	// Generate db/schema.ts (re-export from shared package)
	await fs.writeFile(path.join(dbPath, "schema.ts"), generateSchema(config));

	// Generate schema in shared database package
	await generateSharedSchema(config);
}

function generateDbIndex(_config: AppConfig): string {
	return `import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

export const db = drizzle({
	connection: {
		connectionString: process.env.DATABASE_URL,
		ssl: {
			ca: process.env.DATABASE_SSL_CA,
		},
	},
	schema,
});
`;
}

function generateSchema(config: AppConfig): string {
	return `// Re-export everything from the shared database schema
export * from "@atlas/database/schemas/${config.name}";
`;
}

async function generateSharedSchema(config: AppConfig) {
	const repoRoot = findRepoRoot();
	const schemaPath = path.join(
		repoRoot,
		"packages",
		"database",
		"src",
		"schemas",
		config.name,
	);
	await fs.ensureDir(schemaPath);

	const tableName = `${toSnakeCase(config.name)}_examples`;

	// Generate schema.ts in shared package
	await fs.writeFile(
		path.join(schemaPath, "schema.ts"),
		`import { jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// ============================================================================
// ${config.displayName} Schema
// ============================================================================

export const examples = pgTable("${tableName}", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	data: jsonb("data").notNull(),
	created_at: timestamp("created_at").defaultNow().notNull(),
	updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// Zod Schemas
// ============================================================================

export const insertExampleSchema = createInsertSchema(examples);
export const selectExampleSchema = createSelectSchema(examples);

// ============================================================================
// TypeScript Types
// ============================================================================

export type Example = typeof examples.$inferSelect;
export type InsertExample = typeof examples.$inferInsert;
`,
	);

	// Generate index.ts in shared package
	await fs.writeFile(
		path.join(schemaPath, "index.ts"),
		`export * from "./schema.js";
`,
	);

	// Update database package.json to export the new schema
	await updateDatabasePackageExports(config);
}

async function updateDatabasePackageExports(config: AppConfig) {
	const repoRoot = findRepoRoot();
	const packageJsonPath = path.join(
		repoRoot,
		"packages",
		"database",
		"package.json",
	);

	const packageJson = await fs.readJSON(packageJsonPath);

	// Add the new schema export
	if (!packageJson.exports) {
		packageJson.exports = {};
	}

	packageJson.exports[`./schemas/${config.name}`] = {
		types: `./dist/schemas/${config.name}/index.d.ts`,
		import: `./dist/schemas/${config.name}/index.js`,
	};

	// Write back to package.json with tabs for consistency
	await fs.writeFile(
		packageJsonPath,
		`${JSON.stringify(packageJson, null, "\t")}\n`,
	);

	console.log(
		`✓ Added schema export to @atlas/database: ./schemas/${config.name}`,
	);
}
