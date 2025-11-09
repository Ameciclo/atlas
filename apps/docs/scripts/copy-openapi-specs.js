#!/usr/bin/env node

/**
 * This script copies all openapi.json files from the apps directory
 * to the docs/public/openapi directory for documentation.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appsDir = path.resolve(__dirname, "../../../apps");
const openapiDir = path.resolve(__dirname, "../public/openapi");

// Create the openapi directory if it doesn't exist
if (!fs.existsSync(openapiDir)) {
	fs.mkdirSync(openapiDir, { recursive: true });
	console.log(`Created directory: ${openapiDir}`);
}

// Find all apps directories
const appDirs = fs
	.readdirSync(appsDir, { withFileTypes: true })
	.filter((dirent) => dirent.isDirectory() && dirent.name !== "docs")
	.map((dirent) => dirent.name);

let copiedCount = 0;

for (const appName of appDirs) {
	const openapiFile = path.join(appsDir, appName, "openapi.json");
	
	if (fs.existsSync(openapiFile)) {
		const targetFile = path.join(openapiDir, `${appName}.json`);
		fs.copyFileSync(openapiFile, targetFile);
		console.log(`Copied ${appName}/openapi.json → public/openapi/${appName}.json`);
		copiedCount++;
	}
}

console.log(`\nCopied ${copiedCount} OpenAPI specs to docs/public/openapi/`);