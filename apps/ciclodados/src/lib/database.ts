import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import env from "../env.js";

let db: ReturnType<typeof drizzle>;

if (env.DATABASE_URL) {
	const pool = new Pool({
		connectionString: env.DATABASE_URL,
	});
	db = drizzle(pool);
} else {
	// Mock database for OpenAPI generation
	db = {} as ReturnType<typeof drizzle>;
}

export { db };