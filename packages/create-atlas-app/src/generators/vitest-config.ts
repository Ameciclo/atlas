import type { AppConfig } from "../create-app.js";

export function generateVitestConfig(config: AppConfig): string {
	return `import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		globals: true,
	},
});
`;
}
