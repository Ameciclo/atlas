import { db } from "./index.js";
import { cyclistProfiles } from "./schema.js";
import cyclistProfilesData from "./cyclist_profiles.json" assert { type: "json" };

async function seed() {
  try {
    for (const item of cyclistProfilesData) {
      const { created_at, updated_at, ...data } = item;
      await db.insert(cyclistProfiles).values(data).onConflictDoNothing();
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
