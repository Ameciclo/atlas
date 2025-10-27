import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import app from "./app.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function generateOpenAPISpec() {
	try {
		const openAPIDoc = app.getOpenAPIDocument({
			openapi: "3.1.0",
			info: {
				title: "EmergencyCalls API",
				version: "1.0.0",
				description: "API service for emergency-calls",
				contact: {
					name: "Atlas Team",
					url: "https://github.com/Ameciclo/atlas",
				},
			},
			servers: [
				{
					url: `http://localhost:${process.env.PORT || "3010"}`,
					description: "Local development server",
				},
				{
					url: "https://api.atlas.example.com",
					description: "Production server",
				},
			],
			tags: [
				{
					name: "Example",
					description: "Example endpoints",
				},
				{
					name: "System",
					description: "System endpoints (health check, etc.)",
				},
			],
		});

		const outputPath = join(__dirname, "..", "openapi.json");
		await writeFile(outputPath, JSON.stringify(openAPIDoc, null, 2));

		console.log(`✓ OpenAPI spec generated at ${outputPath}`);
	} catch (error) {
		console.error("Failed to generate OpenAPI spec:", error);
		process.exit(1);
	}
}

generateOpenAPISpec();
