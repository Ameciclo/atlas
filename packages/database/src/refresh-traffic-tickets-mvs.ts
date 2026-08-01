import "dotenv/config";
import { sql } from "drizzle-orm";
import { closeDatabase, createConnectedDatabase } from "./connection.js";

const MVS = [
	"tv_mvs.violations_joined",
	"tv_mvs.mv_temporal",
	"tv_mvs.mv_spatial",
	"tv_mvs.mv_street_category_temporal",
	"tv_mvs.mv_street_agent_temporal",
	"tv_mvs.agent_top_violations",
	"tv_mvs.agent_top_violations_yearly",
	"tv_mvs.category_top_violations_yearly",
	"tv_mvs.street_top_violation",
];

export async function refreshTrafficViolationsMVs() {
	const db = await createConnectedDatabase();

	try {
		console.log("Refreshing materialized views...\n");

		for (const mv of MVS) {
			console.log(`  Refreshing ${mv}...`);
			await db.execute(sql.raw(`REFRESH MATERIALIZED VIEW ${mv}`));
			console.log(`  ${mv} refreshed.`);
		}

		console.log("\nAll materialized views refreshed.\n");
	} catch (error) {
		console.error("Refresh failed:", error);
		throw error;
	} finally {
		await closeDatabase(db);
	}
}

async function main() {
	await refreshTrafficViolationsMVs();
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("Refresh failed:", err);
		process.exit(1);
	});
