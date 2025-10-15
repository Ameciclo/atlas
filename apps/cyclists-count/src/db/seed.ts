import { sql } from "drizzle-orm";
import cyclistsCountsData from "./cyclists_counts.json" with { type: "json" };
import { db } from "./index.js";
import { cyclistsCounts } from "./schema.js";

async function seed() {
	try {
		for (const item of cyclistsCountsData) {
			const { id, coordinates, data, metadata } = item;
			
			await db.insert(cyclistsCounts).values({
				id,
				data,
				metadata,
				coordinates: coordinates ? sql`ST_SetSRID(ST_MakePoint(${coordinates.x}, ${coordinates.y}), 4326)` : null
			}).onConflictDoNothing();
		}

		console.log("Seeding completed successfully!");
	} catch (error) {
		console.error("Error seeding database:", error);
		process.exit(1);
	} finally {
		process.exit(0);
	}
}

seed();
