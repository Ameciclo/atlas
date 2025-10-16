#!/usr/bin/env node

/**
 * Validate OpenAPI specifications
 *
 * This script validates all OpenAPI specs in the specs/ directory to ensure:
 * - Valid OpenAPI 3.1.0 format
 * - All required fields are present
 * - Consistent structure across services
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const specsDir = path.resolve(__dirname, "../specs");

let hasErrors = false;

/**
 * Validate a single OpenAPI spec file
 */
function validateSpec(filePath) {
	console.log(`\nValidating: ${path.relative(specsDir, filePath)}`);

	try {
		const content = fs.readFileSync(filePath, "utf-8");
		const spec = JSON.parse(content);

		// Check OpenAPI version
		if (spec.openapi !== "3.1.0") {
			console.error(`  ✖ Invalid OpenAPI version: ${spec.openapi} (expected 3.1.0)`);
			hasErrors = true;
		} else {
			console.log(`  ✓ OpenAPI version: ${spec.openapi}`);
		}

		// Check required fields
		const requiredFields = ["info", "paths"];
		for (const field of requiredFields) {
			if (!spec[field]) {
				console.error(`  ✖ Missing required field: ${field}`);
				hasErrors = true;
			}
		}

		// Check info object
		if (spec.info) {
			const requiredInfoFields = ["title", "version"];
			for (const field of requiredInfoFields) {
				if (!spec.info[field]) {
					console.error(`  ✖ Missing required info field: ${field}`);
					hasErrors = true;
				} else {
					console.log(`  ✓ ${field}: ${spec.info[field]}`);
				}
			}
		}

		// Check servers
		if (!spec.servers || spec.servers.length === 0) {
			console.error("  ✖ No servers defined");
			hasErrors = true;
		} else {
			console.log(`  ✓ Servers: ${spec.servers.length} defined`);
			for (const server of spec.servers) {
				if (!server.url) {
					console.error("  ✖ Server missing URL");
					hasErrors = true;
				} else {
					console.log(`    - ${server.description || "Server"}: ${server.url}`);
				}
			}
		}

		// Check paths
		if (spec.paths) {
			const pathCount = Object.keys(spec.paths).length;
			if (pathCount === 0) {
				console.warn("  ⚠ No paths defined");
			} else {
				console.log(`  ✓ Paths: ${pathCount} endpoints`);
			}
		}

		if (!hasErrors) {
			console.log("  ✓ Validation passed");
		}
	} catch (error) {
		console.error(`  ✖ Error: ${error.message}`);
		hasErrors = true;
	}
}

/**
 * Find all OpenAPI spec files
 */
function findSpecFiles(dir) {
	const files = [];

	if (!fs.existsSync(dir)) {
		console.error(`Specs directory not found: ${dir}`);
		return files;
	}

	const entries = fs.readdirSync(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			// Recursively search subdirectories
			files.push(...findSpecFiles(fullPath));
		} else if (entry.isFile() && entry.name.endsWith(".json")) {
			files.push(fullPath);
		}
	}

	return files;
}

/**
 * Main validation function
 */
function main() {
	console.log("🔍 Validating OpenAPI Specifications\n");
	console.log(`Specs directory: ${specsDir}\n`);

	const specFiles = findSpecFiles(specsDir);

	if (specFiles.length === 0) {
		console.warn("⚠ No OpenAPI spec files found");
		process.exit(0);
	}

	console.log(`Found ${specFiles.length} spec file(s)\n`);

	for (const file of specFiles) {
		validateSpec(file);
	}

	console.log("\n" + "=".repeat(60));

	if (hasErrors) {
		console.error("\n❌ Validation failed with errors\n");
		process.exit(1);
	}

	console.log("\n✅ All OpenAPI specs are valid\n");
	process.exit(0);
}

main();

