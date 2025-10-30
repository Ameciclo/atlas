import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppConfig } from "../src/create-app.js";
import { generateFiles } from "../src/generators/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testOutputDir = path.join(__dirname, "..", "test-output");

describe("Integration Tests - Full App Generation", () => {
	beforeEach(async () => {
		// Clean up test output directory before each test
		await fs.remove(testOutputDir);
		await fs.ensureDir(testOutputDir);
	});

	afterEach(async () => {
		// Clean up test output directory after each test
		await fs.remove(testOutputDir);
	});

	it("should generate a complete app without database", async () => {
		const config: AppConfig = {
			name: "test-service",
			displayName: "Test Service",
			description: "A test service for testing",
			port: 3000,
			includeDatabase: false,
		};

		const appPath = path.join(testOutputDir, config.name);
		await fs.ensureDir(appPath);
		await generateFiles(appPath, config);

		// Check that all required files exist
		expect(await fs.pathExists(path.join(appPath, "package.json"))).toBe(true);
		expect(await fs.pathExists(path.join(appPath, "Dockerfile"))).toBe(true);
		expect(await fs.pathExists(path.join(appPath, "README.md"))).toBe(true);
		expect(await fs.pathExists(path.join(appPath, "tsconfig.json"))).toBe(true);
		expect(await fs.pathExists(path.join(appPath, "tsconfig.test.json"))).toBe(
			true,
		);
		expect(await fs.pathExists(path.join(appPath, "vitest.config.ts"))).toBe(
			true,
		);
		expect(await fs.pathExists(path.join(appPath, ".env.example"))).toBe(true);

		// Check src files
		expect(await fs.pathExists(path.join(appPath, "src", "app.ts"))).toBe(true);
		expect(await fs.pathExists(path.join(appPath, "src", "index.ts"))).toBe(
			true,
		);
		expect(
			await fs.pathExists(path.join(appPath, "src", "generate-openapi.ts")),
		).toBe(true);
		expect(
			await fs.pathExists(path.join(appPath, "src", "routes", "health.ts")),
		).toBe(true);

		// Check test files
		expect(
			await fs.pathExists(path.join(appPath, "test", "test-service.spec.ts")),
		).toBe(true);

		// Database files should NOT exist
		expect(await fs.pathExists(path.join(appPath, "src", "db"))).toBe(false);
	});

	it("should generate a complete app with database", async () => {
		const config: AppConfig = {
			name: "test-db-service",
			displayName: "Test DB Service",
			description: "A test service with database",
			port: 3001,
			includeDatabase: true,
			databaseName: "test_db_service_db",
		};

		const appPath = path.join(testOutputDir, config.name);
		await fs.ensureDir(appPath);
		await generateFiles(appPath, config);

		// Check database files
		expect(
			await fs.pathExists(path.join(appPath, "src", "db", "index.ts")),
		).toBe(true);
		expect(
			await fs.pathExists(path.join(appPath, "src", "db", "schema.ts")),
		).toBe(true);

		// Check that schema was created in shared database package (relative to repo root)
		const repoRoot = path.join(__dirname, "..", "..", "..");
		const sharedSchemaPath = path.join(
			repoRoot,
			"packages",
			"database",
			"src",
			"schemas",
			config.name,
		);
		expect(await fs.pathExists(path.join(sharedSchemaPath, "schema.ts"))).toBe(
			true,
		);
		expect(await fs.pathExists(path.join(sharedSchemaPath, "index.ts"))).toBe(
			true,
		);

		// Check that database package.json was updated with export
		const dbPackageJson = await fs.readJSON(
			path.join(repoRoot, "packages", "database", "package.json"),
		);
		expect(dbPackageJson.exports).toHaveProperty(`./schemas/${config.name}`);

		// Check that package.json includes database dependencies
		const appPackageJson = await fs.readJSON(
			path.join(appPath, "package.json"),
		);
		expect(appPackageJson.dependencies).toHaveProperty("@atlas/database");
		expect(appPackageJson.dependencies).toHaveProperty("drizzle-orm");
		expect(appPackageJson.dependencies).toHaveProperty("pg");
	});

	it("should update docs integration", async () => {
		const config: AppConfig = {
			name: "test-docs-service",
			displayName: "Test Docs Service",
			description: "A test service for docs integration",
			port: 3002,
			includeDatabase: false,
		};

		const appPath = path.join(testOutputDir, config.name);
		await fs.ensureDir(appPath);
		await generateFiles(appPath, config);

		// Check that OpenAPI spec was added to docs
		const docsSpecPath = path.join(
			process.cwd(),
			"apps",
			"docs",
			"public",
			"openapi",
			`${config.name}.json`,
		);
		expect(await fs.pathExists(docsSpecPath)).toBe(true);

		const spec = await fs.readJSON(docsSpecPath);
		expect(spec.info.title).toBe(`${config.displayName} API`);
		expect(spec.info.description).toBe(config.description);
	});

	it("should generate valid package.json", async () => {
		const config: AppConfig = {
			name: "test-valid-pkg",
			displayName: "Test Valid Package",
			description: "Testing package.json validity",
			port: 3003,
			includeDatabase: false,
		};

		const appPath = path.join(testOutputDir, config.name);
		await fs.ensureDir(appPath);
		await generateFiles(appPath, config);

		const packageJson = await fs.readJSON(path.join(appPath, "package.json"));

		// Validate structure
		expect(packageJson.name).toBe(`@atlas/${config.name}`);
		expect(packageJson.version).toBe("0.1.0");
		expect(packageJson.type).toBe("module");
		expect(packageJson.main).toBe("./dist/index.js");
		expect(packageJson.scripts).toBeDefined();
		expect(packageJson.dependencies).toBeDefined();
		expect(packageJson.devDependencies).toBeDefined();

		// Validate scripts
		expect(packageJson.scripts.build).toBeDefined();
		expect(packageJson.scripts.dev).toBeDefined();
		expect(packageJson.scripts.test).toBeDefined();
		expect(packageJson.scripts["check-types"]).toBeDefined();
	});

	it("should generate valid TypeScript config", async () => {
		const config: AppConfig = {
			name: "test-ts-config",
			displayName: "Test TS Config",
			description: "Testing TypeScript configuration",
			port: 3004,
			includeDatabase: false,
		};

		const appPath = path.join(testOutputDir, config.name);
		await fs.ensureDir(appPath);
		await generateFiles(appPath, config);

		const tsconfig = await fs.readJSON(path.join(appPath, "tsconfig.json"));

		expect(tsconfig.extends).toBe("@atlas/typescript-config/node-service.json");
		expect(tsconfig.compilerOptions.outDir).toBe("./dist");
		expect(tsconfig.compilerOptions.rootDir).toBe("./src");
		expect(tsconfig.include).toContain("src/**/*");
		expect(tsconfig.exclude).toContain("node_modules");
	});

	it("should generate valid test configuration", async () => {
		const config: AppConfig = {
			name: "test-test-config",
			displayName: "Test Test Config",
			description: "Testing test configuration",
			port: 3005,
			includeDatabase: false,
		};

		const appPath = path.join(testOutputDir, config.name);
		await fs.ensureDir(appPath);
		await generateFiles(appPath, config);

		const tsconfigTest = await fs.readJSON(
			path.join(appPath, "tsconfig.test.json"),
		);

		expect(tsconfigTest.extends).toBe("./tsconfig.json");
		expect(tsconfigTest.compilerOptions.types).toContain("vitest/globals");
		expect(tsconfigTest.include).toContain("test/**/*");

		const vitestConfig = await fs.readFile(
			path.join(appPath, "vitest.config.ts"),
			"utf-8",
		);
		expect(vitestConfig).toContain("vitest/config");
		expect(vitestConfig).toContain("globals: true");
	});

	it("should generate health check route", async () => {
		const config: AppConfig = {
			name: "test-health",
			displayName: "Test Health",
			description: "Testing health check",
			port: 3006,
			includeDatabase: false,
		};

		const appPath = path.join(testOutputDir, config.name);
		await fs.ensureDir(appPath);
		await generateFiles(appPath, config);

		const healthRoute = await fs.readFile(
			path.join(appPath, "src", "routes", "health.ts"),
			"utf-8",
		);

		expect(healthRoute).toContain("/health");
		expect(healthRoute).toContain('status: "ok"');
		expect(healthRoute).toContain(`service: "${config.name}"`);
	});

	it("should generate basic test file", async () => {
		const config: AppConfig = {
			name: "test-basic-test",
			displayName: "Test Basic Test",
			description: "Testing basic test file",
			port: 3007,
			includeDatabase: false,
		};

		const appPath = path.join(testOutputDir, config.name);
		await fs.ensureDir(appPath);
		await generateFiles(appPath, config);

		const testFile = await fs.readFile(
			path.join(appPath, "test", `${config.name}.spec.ts`),
			"utf-8",
		);

		expect(testFile).toContain("describe");
		expect(testFile).toContain("it");
		expect(testFile).toContain("/health");
		expect(testFile).toContain(`"service", "${config.name}"`);
	});
});
