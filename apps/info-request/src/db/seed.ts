import "dotenv/config";
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
