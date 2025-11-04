import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		globals: true,
		env: {
			DATABASE_URL:
				process.env.DATABASE_URL ||
				"postgresql://postgres:postgres@localhost:5432/atlas_dev",
			NODE_ENV: "test",
		},
	},
});
