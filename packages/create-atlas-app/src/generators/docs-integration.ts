import path from "node:path";
import fs from "fs-extra";
import type { AppConfig } from "../create-app.js";

/**
 * Updates the docs app to include the new API's OpenAPI spec
 */
export async function updateDocsIntegration(config: AppConfig) {
	const docsOpenapiDir = path.join(
		process.cwd(),
		"apps",
		"docs",
		"public",
		"openapi",
	);

	// Ensure the openapi directory exists
	await fs.ensureDir(docsOpenapiDir);

	// Create a placeholder spec file that will be replaced by the actual spec during build
	const placeholderSpec = {
		openapi: "3.1.0",
		info: {
			title: `${config.displayName} API`,
			version: "1.0.0",
			description: config.description,
		},
		servers: [
			{
				url: `http://localhost:${config.port}`,
				description: "Development server",
			},
		],
		paths: {},
	};

	const specPath = path.join(docsOpenapiDir, `${config.name}.json`);
	await fs.writeJSON(specPath, placeholderSpec, { spaces: 2 });

	console.log(`✓ Added placeholder OpenAPI spec to docs: ${config.name}.json`);
	console.log(
		`  Note: Run 'pnpm --filter @atlas/${config.name} build' to generate the actual spec`,
	);
}
