import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		env: {
			DATABASE_URL:
				"postgresql://postgres:postgres@localhost:5432/atlas_dev?sslmode=disable",
			NODE_ENV: "test",
			PORT: "3020",
		},
	},
});
