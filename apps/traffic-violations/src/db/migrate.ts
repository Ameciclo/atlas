import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

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
