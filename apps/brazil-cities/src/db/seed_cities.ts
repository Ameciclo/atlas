// db/seed/global/seed.ts
import * as schema from "./table_cities";
import { db, readCsv } from "../../utils";
import path from "path";

type CityCsv = {
  id: string;
  name: string;
  state: string;
  full_state: string;
  rmr: string;
};

export async function seedCities() {
  // 1) Seed text fields from CSV
  const csvPath = path.resolve(__dirname, "cities.csv");
  const rows = await readCsv<CityCsv>(csvPath);

  const cities = rows.map((r) => ({
    id: Number(r.id),
    name: r.name,
    state: r.state,
    full_state: r.full_state.trim(),
    rmr: r.rmr.toLowerCase() === "true",
  }));

  await db.insert(schema.cities).values(cities).onConflictDoNothing().execute();
  console.log(`✅ Seeded ${cities.length} cities`);
}

// If run directly: `tsx db/seed/global/seed.ts`
if (require.main === module) {
  seedCities()
    .then(() => {
      console.log('✅ Seed concluído!');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
