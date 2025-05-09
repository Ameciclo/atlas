#!/usr/bin/env node

/**
 * This script scans the public/openapi directory for OpenAPI spec files
 * and generates an index.json file that lists all available specs.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const openapiDir = path.resolve(__dirname, "../public/openapi");
const indexPath = path.join(openapiDir, "index.json");

// Create the openapi directory if it doesn't exist
if (!fs.existsSync(openapiDir)) {
	fs.mkdirSync(openapiDir, { recursive: true });
	console.log(`Created directory: ${openapiDir}`);
}

// Get all JSON and YAML files in the openapi directory, excluding index.json
const specFiles = fs
	.readdirSync(openapiDir)
	.filter(
		(file) =>
			(file.endsWith(".json") ||
				file.endsWith(".yaml") ||
				file.endsWith(".yml")) &&
			file !== "index.json",
	);

// Format API name from filename
function formatApiName(filename) {
	// Remove file extension
	const nameWithoutExt = filename.replace(/\.(json|yaml|yml)$/, "");

	// Convert kebab-case to Title Case
	return `${nameWithoutExt
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ")} API`;
}

// Create an array of spec sources
const specs = specFiles.map((file) => ({
	url: `/openapi/${file}`,
	title: formatApiName(file),
}));

// Write the index file
fs.writeFileSync(indexPath, JSON.stringify(specs, null, 2));

console.log(`Generated OpenAPI index with ${specs.length} specs:`);
for (const spec of specs) {
	console.log(`- ${spec.title}: ${spec.url}`);
}
