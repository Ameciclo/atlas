import "dotenv/config";
import { reset } from "drizzle-seed";
import { closeDatabase, createConnectedDatabase } from "./connection.js";
import * as schema from "./schemas/index.js";

async function resetDatabase() {
	console.log("🗑️  Resetting database...");
	const db = await createConnectedDatabase();

	try {
		await reset(db, schema);
		console.log("✅ Database reset successfully!");
	} catch (error) {
		console.error("❌ Error resetting database:", error);
		throw error;
	} finally {
		await closeDatabase(db);
	}
}

resetDatabase().catch((error) => {
	console.error(error);
	process.exit(1);
});
