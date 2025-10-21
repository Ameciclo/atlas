import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppConfig } from "../src/create-app.js";
import { generateDockerCompose } from "../src/generators/docker-compose.js";
import { generateDockerfile } from "../src/generators/dockerfile.js";
import { generateEnvExample } from "../src/generators/env-example.js";
import { generatePackageJson } from "../src/generators/package-json.js";
import { generateReadme } from "../src/generators/readme.js";
import { generateTsConfig } from "../src/generators/tsconfig.js";
import { generateVitestConfig } from "../src/generators/vitest-config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(__dirname, "..", "test-output");

describe("Package JSON Generator", () => {
	const baseConfig: AppConfig = {
		name: "test-service",
		displayName: "Test Service",
		description: "A test service",
		port: 3000,
		includeDatabase: false,
	};

	it("should generate basic package.json without database", () => {
		const pkg = generatePackageJson(baseConfig);

		expect(pkg.name).toBe("@atlas/test-service");
		expect(pkg.version).toBe("0.1.0");
		expect(pkg.description).toBe("A test service");
		expect(pkg.type).toBe("module");
		expect(pkg.scripts).toHaveProperty("build");
		expect(pkg.scripts).toHaveProperty("dev");
		expect(pkg.scripts).toHaveProperty("test");
		expect(pkg.dependencies).toHaveProperty("hono");
		expect(pkg.dependencies).toHaveProperty("@hono/zod-openapi");
		expect(pkg.dependencies).not.toHaveProperty("@atlas/database");
	});

	it("should generate package.json with database dependencies", () => {
		const configWithDb: AppConfig = {
			...baseConfig,
			includeDatabase: true,
		};

		const pkg = generatePackageJson(configWithDb);

		expect(pkg.dependencies).toHaveProperty("@atlas/database", "workspace:*");
		expect(pkg.dependencies).toHaveProperty("drizzle-orm");
		expect(pkg.dependencies).toHaveProperty("pg");
		expect(pkg.devDependencies).toHaveProperty("@types/pg");
	});

	it("should include correct scripts", () => {
		const pkg = generatePackageJson(baseConfig);

		expect(pkg.scripts.build).toContain("tsc");
		expect(pkg.scripts.dev).toContain("tsx watch");
		expect(pkg.scripts.test).toContain("vitest");
		expect(pkg.scripts["check-types"]).toContain("tsc --noEmit");
		expect(pkg.scripts["generate-openapi"]).toContain(
			"tsx src/generate-openapi.ts",
		);
	});
});

describe("Dockerfile Generator", () => {
	const baseConfig: AppConfig = {
		name: "test-service",
		displayName: "Test Service",
		description: "A test service",
		port: 3000,
		includeDatabase: false,
	};

	it("should generate Dockerfile without database", () => {
		const dockerfile = generateDockerfile(baseConfig);

		expect(dockerfile).toContain("FROM node:22.15.0-slim");
		expect(dockerfile).toContain("pnpm --filter @atlas/test-service build");
		expect(dockerfile).toContain("EXPOSE ${PORT}");
		expect(dockerfile).not.toContain("packages/database");
	});

	it("should generate Dockerfile with database package", () => {
		const configWithDb: AppConfig = {
			...baseConfig,
			includeDatabase: true,
		};

		const dockerfile = generateDockerfile(configWithDb);

		expect(dockerfile).toContain("packages/database/package.json");
		expect(dockerfile).toContain("COPY packages/database ./packages/database");
		expect(dockerfile).toContain("pnpm --filter @atlas/database build");
		expect(dockerfile).toContain(
			"COPY --from=builder /app/packages/database/dist",
		);
		expect(dockerfile).toContain("packages/database/src/migrations");
	});

	it("should use correct Node.js version", () => {
		const dockerfile = generateDockerfile(baseConfig);

		expect(dockerfile).toContain("FROM node:22.15.0-slim");
	});
});

describe("Docker Compose Generator", () => {
	const baseConfig: AppConfig = {
		name: "test-service",
		displayName: "Test Service",
		description: "A test service",
		port: 3000,
		includeDatabase: false,
	};

	it("should generate docker-compose.yml without database", () => {
		const compose = generateDockerCompose(baseConfig);

		expect(compose).toContain("services:");
		expect(compose).toContain("app:");
		expect(compose).toContain("${PORT:-3000}:${PORT:-3000}");
		expect(compose).not.toContain("postgres:");
		expect(compose).not.toContain("DATABASE_URL");
	});

	it("should generate docker-compose.yml with database", () => {
		const configWithDb: AppConfig = {
			...baseConfig,
			includeDatabase: true,
			databaseName: "test_service_db",
		};

		const compose = generateDockerCompose(configWithDb);

		expect(compose).toContain("postgres:");
		expect(compose).toContain("postgres:16-alpine");
		expect(compose).toContain("DATABASE_URL");
		expect(compose).toContain("test_service_db");
		expect(compose).toContain("depends_on:");
	});
});

describe("README Generator", () => {
	const baseConfig: AppConfig = {
		name: "test-service",
		displayName: "Test Service",
		description: "A test service",
		port: 3000,
		includeDatabase: false,
	};

	it("should generate README with correct title and description", () => {
		const readme = generateReadme(baseConfig);

		expect(readme).toContain("# Test Service");
		expect(readme).toContain("A test service");
	});

	it("should include development instructions", () => {
		const readme = generateReadme(baseConfig);

		expect(readme).toContain("## Development");
		expect(readme).toContain("pnpm install");
		expect(readme).toContain("pnpm --filter @atlas/test-service dev");
	});

	it("should include API documentation section", () => {
		const readme = generateReadme(baseConfig);

		expect(readme).toContain("## API Documentation");
		expect(readme).toContain("http://localhost:3001");
	});

	it("should include database section when database is enabled", () => {
		const configWithDb: AppConfig = {
			...baseConfig,
			includeDatabase: true,
		};

		const readme = generateReadme(configWithDb);

		expect(readme).toContain("## Database");
		expect(readme).toContain("@atlas/database");
		expect(readme).toContain("pnpm --filter @atlas/database");
	});
});

describe("TypeScript Config Generator", () => {
	it("should generate correct tsconfig.json", () => {
		const config: AppConfig = {
			name: "test-service",
			displayName: "Test Service",
			description: "A test service",
			port: 3000,
			includeDatabase: false,
		};

		const tsconfig = generateTsConfig(config);

		expect(tsconfig.extends).toBe("@atlas/typescript-config/node-service.json");
		expect(tsconfig.compilerOptions.outDir).toBe("./dist");
		expect(tsconfig.compilerOptions.rootDir).toBe("./src");
		expect(tsconfig.include).toContain("src/**/*");
		expect(tsconfig.exclude).toContain("node_modules");
		expect(tsconfig.exclude).toContain("dist");
		expect(tsconfig.exclude).toContain("test");
	});
});

describe("Vitest Config Generator", () => {
	it("should generate correct vitest.config.ts", () => {
		const config: AppConfig = {
			name: "test-service",
			displayName: "Test Service",
			description: "A test service",
			port: 3000,
			includeDatabase: false,
		};

		const vitestConfig = generateVitestConfig(config);

		expect(vitestConfig).toContain(
			'import { defineConfig } from "vitest/config"',
		);
		expect(vitestConfig).toContain("globals: true");
		expect(vitestConfig).toContain('environment: "node"');
	});
});

describe("Environment Example Generator", () => {
	const baseConfig: AppConfig = {
		name: "test-service",
		displayName: "Test Service",
		description: "A test service",
		port: 3000,
		includeDatabase: false,
	};

	it("should generate .env.example without database", () => {
		const env = generateEnvExample(baseConfig);

		expect(env).toContain("PORT=3000");
		expect(env).toContain("NODE_ENV=development");
		expect(env).not.toContain("DATABASE_URL");
	});

	it("should generate .env.example with database", () => {
		const configWithDb: AppConfig = {
			...baseConfig,
			includeDatabase: true,
			databaseName: "test_service_db",
		};

		const env = generateEnvExample(configWithDb);

		expect(env).toContain("PORT=3000");
		expect(env).toContain("DATABASE_URL=");
		expect(env).toContain("test_service_db");
	});
});
