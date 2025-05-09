// biome-ignore lint: This is a template file that will be copied and customized
/**
 * Template for generating OpenAPI specs from Hono apps
 *
 * Copy this file to your API service's src directory and customize as needed.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import app from "./app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * The name of your API service (used in the output filename)
 * Use kebab-case (e.g., "user-service", "payment-api")
 */
const API_NAME = "your-api-name";

async function generateOpenAPISpec() {
	try {
		// Get the OpenAPI document from the Hono app
		const openAPIDoc = app.getOpenAPIDocument({
			openapi: "3.1.0",
			info: {
				title: `${API_NAME} API`,
				version: "1.0.0",
				description: "Description of your API",
				contact: {
					name: "Atlas Team",
					url: "https://github.com/Ameciclo/atlas",
				},
			},
			servers: [
				{
					url: "http://localhost:3000", // Update with your service's port
					description: "Local development server",
				},
			],
			tags: [
				// Define your API tags here
				{
					name: "Example",
					description: "Example endpoints",
				},
			],
		});

		// Create the output directory if it doesn't exist
		const outputDir = path.resolve(__dirname, "../../docs/public/openapi");
		fs.mkdirSync(outputDir, { recursive: true });

		// Write the OpenAPI spec to a file
		const outputPath = path.join(outputDir, `${API_NAME}.json`);
		fs.writeFileSync(outputPath, JSON.stringify(openAPIDoc, null, 2));

		console.log(`OpenAPI spec generated at ${outputPath}`);
		console.log("Generated OpenAPI spec for routes:");

		// Log the routes that were included in the OpenAPI spec
		const paths = Object.keys(openAPIDoc.paths || {});
		for (const path of paths) {
			console.log(`  - ${path}`);
		}
	} catch (error) {
		console.error("Error generating OpenAPI spec:", error);
		process.exit(1);
	}
}

generateOpenAPISpec();
