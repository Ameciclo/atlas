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
	await fs.ensureDir(path.join(dbPath, "migrations"));

	// Generate drizzle.config.ts
	await fs.writeFile(
		path.join(appPath, "drizzle.config.ts"),
		generateDrizzleConfig(config),
	);

	// Generate db/index.ts
	await fs.writeFile(path.join(dbPath, "index.ts"), generateDbIndex(config));

	// Generate db/schema.ts
	await fs.writeFile(path.join(dbPath, "schema.ts"), generateSchema(config));

	// Generate db/migrate.ts
	await fs.writeFile(path.join(dbPath, "migrate.ts"), generateMigrate(config));

	// Generate db/seed.ts
	await fs.writeFile(path.join(dbPath, "seed.ts"), generateSeed(config));
}

function generateDrizzleConfig(config: AppConfig): string {
	return `import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./src/db/schema.ts",
	out: "./src/db/migrations",
	dialect: "postgresql",
	dbCredentials: {
		host: process.env.DB_HOST || "localhost",
		port: Number.parseInt(process.env.DB_PORT || "5432"),
		user: process.env.DB_USER || "postgres",
		password: process.env.DB_PASSWORD || "postgres",
		database: process.env.DB_NAME || "${config.databaseName}",
		ssl: process.env.DB_SSL === "true",
	},
});
`;
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
	const tableName = `${toSnakeCase(config.name)}_examples`;

	return `import { jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const examples = pgTable("${tableName}", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	data: jsonb("data").notNull(),
	created_at: timestamp("created_at").defaultNow().notNull(),
	updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const insertExampleSchema = createInsertSchema(examples);
export const selectExampleSchema = createSelectSchema(examples);

export type Example = typeof examples.$inferSelect;
export type InsertExample = typeof examples.$inferInsert;
`;
}

function generateMigrate(config: AppConfig): string {
	return `import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
	console.log("Running migrations...");

	const db = drizzle({
		connection: {
			connectionString: process.env.DATABASE_URL,
			ssl: process.env.DB_SSL === "true",
		},
	});

	await migrate(db, {
		migrationsFolder: path.join(__dirname, "migrations"),
	});

	console.log("✓ Migrations completed");
	process.exit(0);
}

runMigrations().catch((error) => {
	console.error("Migration failed:", error);
	process.exit(1);
});
`;
}

function generateSeed(config: AppConfig): string {
	return `import "dotenv/config";
import { db } from "./index.js";
import { examples } from "./schema.js";

async function seed() {
	console.log("Seeding database...");

	try {
		// Insert example data
		await db.insert(examples).values([
			{
				name: "Example 1",
				data: { description: "First example" },
			},
			{
				name: "Example 2",
				data: { description: "Second example" },
			},
		]);

		console.log("✓ Database seeded successfully");
	} catch (error) {
		console.error("Seeding failed:", error);
		throw error;
	}
}

seed()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
`;
}
