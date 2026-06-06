import "dotenv/config";
import { db } from "./index.js";
import { trafficViolations } from "./schema.js";

async function seed() {
	console.log("Seeding database...");

	try {
		// Insert example data
		await db.insert(trafficViolations).values([
			{
				violation_date: new Date(),
				agent_id: 1,
				location_id: 1,
				cttu_code: "001",
				law_code: "CTB-001",
				description: "Example violation",
				location_description: "Example location",
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
