import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: ["./src/schemas/*/schema.ts", "./src/schemas/*/views.ts"],
	out: "./src/migrations",
	dialect: "postgresql",
	dbCredentials: {
		url:
			process.env.DATABASE_URL ||
			"postgresql://postgres:postgres@localhost:5432/atlas_dev",
	},
});
