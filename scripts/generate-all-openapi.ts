#!/usr/bin/env tsx

/**
 * Auto-discovery script for generating OpenAPI specs from all API apps
 *
 * This script:
 * 1. Discovers all apps in the monorepo that have OpenAPI generation capability
 * 2. Runs the generate-openapi script for each discovered app
 * 3. Copies the generated specs to the docs app
 * 4. Generates an index of all available specs
 *
 * Discovery criteria:
 * - App must have a package.json with a "generate-openapi" script
 * - App must have a src/generate-openapi.ts file
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const appsDir = path.join(rootDir, "apps");

interface DiscoveredApp {
	name: string;
	path: string;
	packageName: string;
	hasGenerateScript: boolean;
	hasGenerateFile: boolean;
}

/**
 * Discover all apps that can generate OpenAPI specs
 */
function discoverOpenAPIApps(): DiscoveredApp[] {
	const apps: DiscoveredApp[] = [];

	// Get all directories in apps/
	const appDirs = fs
		.readdirSync(appsDir, { withFileTypes: true })
		.filter((dirent) => dirent.isDirectory())
		.map((dirent) => dirent.name);

	for (const appName of appDirs) {
		const appPath = path.join(appsDir, appName);
		const packageJsonPath = path.join(appPath, "package.json");
		const generateFilePath = path.join(appPath, "src/generate-openapi.ts");

		// Skip if no package.json
		if (!fs.existsSync(packageJsonPath)) {
			continue;
		}

		// Read package.json
		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

		// Check if app has generate-openapi script
		const hasGenerateScript = Boolean(
			packageJson.scripts?.["generate-openapi"],
		);

		// Check if app has generate-openapi.ts file
		const hasGenerateFile = fs.existsSync(generateFilePath);

		// Only include apps that have both
		if (hasGenerateScript && hasGenerateFile) {
			apps.push({
				name: appName,
				path: appPath,
				packageName: packageJson.name,
				hasGenerateScript,
				hasGenerateFile,
			});
		}
	}

	return apps;
}

/**
 * Generate OpenAPI spec for a single app
 */
function generateOpenAPIForApp(app: DiscoveredApp): boolean {
	console.log(`\n📝 Generating OpenAPI spec for ${app.name}...`);

	try {
		// Run the generate-openapi script for this app
		execSync(`pnpm --filter ${app.packageName} generate-openapi`, {
			cwd: rootDir,
			stdio: "inherit",
		});

		console.log(`✅ Successfully generated OpenAPI spec for ${app.name}`);
		return true;
	} catch (error) {
		console.error(`❌ Failed to generate OpenAPI spec for ${app.name}:`, error);
		return false;
	}
}

/**
 * Main execution
 */
async function main() {
	console.log("🔍 Discovering apps with OpenAPI generation capability...\n");

	const apps = discoverOpenAPIApps();

	if (apps.length === 0) {
		console.log("⚠️  No apps with OpenAPI generation found.");
		console.log("\nTo make an app discoverable, ensure it has:");
		console.log('  1. A "generate-openapi" script in package.json');
		console.log("  2. A src/generate-openapi.ts file");
		process.exit(0);
	}

	console.log(`Found ${apps.length} app(s) with OpenAPI generation:\n`);
	for (const app of apps) {
		console.log(`  ✓ ${app.name} (${app.packageName})`);
	}

	console.log("\n" + "=".repeat(60));
	console.log("Starting OpenAPI generation...");
	console.log("=".repeat(60));

	let successCount = 0;
	let failureCount = 0;

	for (const app of apps) {
		const success = generateOpenAPIForApp(app);
		if (success) {
			successCount++;
		} else {
			failureCount++;
		}
	}

	console.log("\n" + "=".repeat(60));
	console.log("OpenAPI Generation Summary");
	console.log("=".repeat(60));
	console.log(`✅ Successful: ${successCount}`);
	console.log(`❌ Failed: ${failureCount}`);
	console.log(`📊 Total: ${apps.length}`);

	if (failureCount > 0) {
		console.log("\n⚠️  Some specs failed to generate. Check the errors above.");
		process.exit(1);
	}

	console.log("\n🎉 All OpenAPI specs generated successfully!");
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});

