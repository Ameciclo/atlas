import cyclistProfilesData from "./cyclist_profiles.json" with { type: "json" };
import { closeDb, getDb } from "./index.js";
import { cyclistProfiles } from "./schema.js";

async function seed() {
	try {
		const db = await getDb();

		for (const item of cyclistProfilesData) {
			const { created_at, updated_at, ...data } = item;

			if (data.metadata?.date && data.metadata?.hour) {
				const datePart = data.metadata.date.split("T")[0];
				const timePart = data.metadata.hour.includes("T")
					? data.metadata.hour.split("T")[1]
					: data.metadata.hour;

				data.metadata.date = `${datePart}T${timePart}`;
			}

			await db.insert(cyclistProfiles).values(data).onConflictDoNothing();
		}

		console.log("Seeding completed successfully!");
	} catch (error) {
		console.error("Error seeding database:", error);
		process.exit(1);
	} finally {
		await closeDb();
		process.exit(0);
	}
}

seed();
