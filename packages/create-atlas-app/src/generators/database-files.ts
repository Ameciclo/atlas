import path from "node:path";
import fs from "fs-extra";
import type { AppConfig } from "../create-app.js";
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

function generateDbIndex(config: AppConfig): string {
	return `import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

export const db = drizzle({
	connection: {
		connectionString: process.env.DATABASE_URL,
		ssl: process.env.DB_SSL === "true",
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
	const schemaPath = path.join(
		process.cwd(),
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
}
