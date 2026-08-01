import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import app from "./app.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_NAME = "cyclist-profile";

function getVersion(): string {
	try {
		const packageJsonPath = path.resolve(__dirname, "../package.json");
		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
		return packageJson.version || "1.0.0";
	} catch (_error) {
		console.warn("Could not read version from package.json, using 1.0.0");
		return "1.0.0";
	}
}

async function generateOpenAPISpec() {
	try {
		const version = getVersion();
		const openAPIDoc = app.getOpenAPIDocument({
			openapi: "3.1.0",
			info: {
				title: "Cyclist Profile API",
				version,
				description:
					"API for managing and analyzing cyclist profile survey data",
				contact: {
					name: "Atlas Team",
					url: "https://github.com/Ameciclo/atlas",
				},
			},
			servers: [
				{
					url: `http://localhost:${process.env.PORT || "3000"}`,
					description: "Local development server",
				},
				{
					url:
						process.env.API_BASE_URL ||
						"https://api.ameciclo.org/cyclist-profile",
					description: "Production server",
				},
			],
			tags: [
				{
					name: "System",
					description: "System operations",
				},
				{
					name: "Cyclist Profiles",
					description: "Operations related to cyclist profiles",
				},
				{
					name: "Cyclist Analytics",
					description: "Analytics and insights for cyclist data",
				},
			],
		});

		const specJson = JSON.stringify(openAPIDoc, null, 2);

		const specsDir = path.resolve(__dirname, "../../../specs", API_NAME);
		fs.mkdirSync(specsDir, { recursive: true });
		const specsPath = path.join(specsDir, `v${version.split(".")[0]}.json`);
		fs.writeFileSync(specsPath, specJson);
		console.log(`OpenAPI spec written to ${specsPath}`);

		const docsDir = path.resolve(__dirname, "../../docs/public/openapi");
		fs.mkdirSync(docsDir, { recursive: true });
		const docsPath = path.join(docsDir, `${API_NAME}.json`);
		fs.writeFileSync(docsPath, specJson);
		console.log(`OpenAPI spec copied to ${docsPath}`);

		console.log("\nGenerated OpenAPI spec for routes:");
		const paths = Object.keys(openAPIDoc.paths || {});
		for (const p of paths) {
			console.log(`  - ${p}`);
		}
	} catch (error) {
		console.error("Failed to generate OpenAPI spec:", error);
		process.exit(1);
	}
}

generateOpenAPISpec();
