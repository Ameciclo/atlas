import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import app from "./app.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_NAME = "cycling-infra";

async function generateOpenAPISpec() {
	try {
		const openAPIDoc = app.getOpenAPIDocument({
			openapi: "3.1.0",
			info: {
				title: "CyclingInfra API",
				version: "1.0.0",
				description: "API service for cycling-infra",
				contact: {
					name: "Atlas Team",
					url: "https://github.com/Ameciclo/atlas",
				},
			},
			servers: [
				{
					url: `http://localhost:${process.env.PORT || "3020"}`,
					description: "Local development server",
				},
				{
					url: "https://api.atlas.example.com",
					description: "Production server",
				},
			],
			tags: [
				{
					name: "Infrastructure",
					description: "Cycling infrastructure operations",
				},
				{
					name: "Relations",
					description: "PDC cycling infrastructure relations",
				},
				{
					name: "Ways",
					description: "Cycling infrastructure ways",
				},
				{
					name: "System",
					description: "System endpoints (health check, etc.)",
				},
			],
		});

		const specJson = JSON.stringify(openAPIDoc, null, 2);

		// 1. Write to local directory
		const outputPath = path.join(__dirname, "..", "openapi.json");
		fs.writeFileSync(outputPath, specJson);
		console.log(`✓ OpenAPI spec generated at ${outputPath}`);

		// 2. Copy to docs directory
		const docsDir = path.resolve(__dirname, "../../docs/public/openapi");
		fs.mkdirSync(docsDir, { recursive: true });
		const docsPath = path.join(docsDir, `${API_NAME}.json`);
		fs.writeFileSync(docsPath, specJson);
		console.log(`✓ OpenAPI spec copied to ${docsPath}`);

		console.log("\nGenerated OpenAPI spec for routes:");
		const paths = Object.keys(openAPIDoc.paths || {});
		for (const path of paths) {
			console.log(`  - ${path}`);
		}
	} catch (error) {
		console.error("Failed to generate OpenAPI spec:", error);
		process.exit(1);
	}
}

generateOpenAPISpec();
