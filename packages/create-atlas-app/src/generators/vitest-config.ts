import type { AppConfig } from "../create-app.js";

export function generateVitestConfig(config: AppConfig): string {
	const envConfig = config.includeDatabase
		? `
		env: {
			DATABASE_URL:
				process.env.DATABASE_URL ||
				"postgresql://postgres:postgres@localhost:5432/atlas",
		},`
		: "";

	return `import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		globals: true,${envConfig}
	},
});
`;
}
