import path from "node:path";
import fs from "fs-extra";
import type { AppConfig } from "../create-app.js";
import { generateDatabaseFiles } from "./database-files.js";
import { generateDockerfile } from "./dockerfile.js";
import { generateGitignore } from "./gitignore.js";
import { updateDocsIntegration } from "./docs-integration.js";
import { generateEnvExample } from "./env-example.js";
import { generatePackageJson } from "./package-json.js";
import { generateReadme } from "./readme.js";
import { generateSrcFiles } from "./src-files.js";
import { generateTsConfig } from "./tsconfig.js";
import { generateVitestConfig } from "./vitest-config.js";

export async function generateFiles(appPath: string, config: AppConfig) {
	// Generate package.json
	await fs.writeJSON(
		path.join(appPath, "package.json"),
		generatePackageJson(config),
		{ spaces: "\t" },
	);

	// Generate .gitignore
	await fs.writeFile(
		path.join(appPath, ".gitignore"),
		generateGitignore(config),
	);

	// Generate Dockerfile
	await fs.writeFile(
		path.join(appPath, "Dockerfile"),
		generateDockerfile(config),
	);

	// Generate README.md
	await fs.writeFile(path.join(appPath, "README.md"), generateReadme(config));

	// Generate tsconfig.json
	await fs.writeJSON(
		path.join(appPath, "tsconfig.json"),
		generateTsConfig(config),
		{ spaces: "\t" },
	);

	// Generate tsconfig.test.json
	await fs.writeJSON(
		path.join(appPath, "tsconfig.test.json"),
		{
			extends: "./tsconfig.json",
			compilerOptions: {
				rootDir: ".",
				noEmit: true,
				types: ["node", "vitest/globals"],
			},
			include: ["src/**/*", "test/**/*"],
			exclude: ["node_modules", "dist"],
		},
		{ spaces: "\t" },
	);

	// Generate vitest.config.ts
	await fs.writeFile(
		path.join(appPath, "vitest.config.ts"),
		generateVitestConfig(config),
	);

	// Generate .env.example
	await fs.writeFile(
		path.join(appPath, ".env.example"),
		generateEnvExample(config),
	);

	// Generate src files
	await generateSrcFiles(appPath, config);

	// Generate database files if needed
	if (config.includeDatabase) {
		await generateDatabaseFiles(appPath, config);
	}

	// Generate test directory
	await fs.ensureDir(path.join(appPath, "test"));
	await fs.writeFile(
		path.join(appPath, "test", `${config.name}.spec.ts`),
		generateTestFile(config),
	);

	// Update docs integration
	await updateDocsIntegration(config);
}

function generateTestFile(config: AppConfig): string {
	return `import { describe, it, expect } from "vitest";
import app from "../src/app.js";

describe("${config.displayName} API", () => {
	it("should return health check", async () => {
		const res = await app.request("/health");
		expect(res.status).toBe(200);
		
		const data = await res.json();
		expect(data).toHaveProperty("status", "ok");
		expect(data).toHaveProperty("service", "${config.name}");
	});

	// Add more tests here
});
`;
}
