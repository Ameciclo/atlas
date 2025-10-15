import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./src/schemas/*/schema.ts",
	out: "./src/migrations",
	dialect: "postgresql",
	dbCredentials: {
		host: process.env.DB_HOST || "localhost",
		port: Number.parseInt(process.env.DB_PORT || "5432"),
		user: process.env.DB_USER || "postgres",
		password: process.env.DB_PASSWORD || "postgres",
		database: process.env.DB_NAME || "atlas",
		ssl: process.env.DB_SSL === "true",
	},
	schemaFilter: ["public", "cyclist_profile", "analytics", "notifications"],
});
