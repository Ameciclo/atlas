import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import app from "./app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * The name of this API service (used in the output filename)
 */
const API_NAME = "cyclist-profile";

async function generateOpenAPISpec() {
	try {
		const openAPIDoc = app.getOpenAPIDocument({
			openapi: "3.1.0",
			info: {
				title: "Cyclist Profile API",
				version: "1.0.0",
				description: "API for managing cyclist profiles",
				contact: {
					name: "Atlas Team",
					url: "https://github.com/Ameciclo/atlas",
				},
			},
			servers: [
				{
					url: "http://localhost:3000",
					description: "Local development server",
				},
				{
					url: "https://api.atlas.example.com",
					description: "Production server",
				},
			],
			tags: [
				{
					name: "Cyclist Profiles",
					description: "Operations related to cyclist profiles",
				},
				{
					name: "System",
					description: "System operations",
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
