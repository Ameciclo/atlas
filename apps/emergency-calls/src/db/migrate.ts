import { runMigrations } from "@atlas/database";

async function migrate() {
	console.log("🔄 Running database migrations...");
	
	try {
		await runMigrations();
		console.log("✅ Database migrations completed successfully");
	} catch (error) {
		console.error("❌ Migration failed:", error);
		process.exit(1);
	}
}

migrate()
	.then(() => {
		console.log("✅ Migration process completed");
		process.exit(0);
	})
	.catch((error) => {
		console.error("❌ Migration process failed:", error);
		process.exit(1);
	});