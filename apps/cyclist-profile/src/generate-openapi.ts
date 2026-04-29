import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createApp, { createRouter } from "./lib/create-app.js";
import * as routes from "./routes/cyclist-profiles/cyclist-profiles.routes.js";
import * as analyticsRoutes from "./routes/cyclist-profiles/analytics.routes.js";
import * as healthRoutes from "./routes/health.routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Create a spec-only app without importing handlers (which require database)
 * We only need route schemas for OpenAPI generation, not the actual handlers
 * The handlers are never called during spec generation, so we use dummy functions
 */
function createSpecApp() {
	const cyclistRouter = createRouter()
		// biome-ignore lint/suspicious/noExplicitAny: Dummy handlers for spec generation only
		.openapi(routes.list, null as any)
		// biome-ignore lint/suspicious/noExplicitAny: Dummy handlers for spec generation only
		.openapi(routes.getOne, null as any)
		// biome-ignore lint/suspicious/noExplicitAny: Dummy handlers for spec generation only
		.openapi(routes.nearby, null as any)
		// biome-ignore lint/suspicious/noExplicitAny: Dummy handlers for spec generation only
		.openapi(routes.nearbySummary, null as any);

	const analyticsRouter = createRouter()
		// biome-ignore lint/suspicious/noExplicitAny: Dummy handlers for spec generation only
		.openapi(analyticsRoutes.summary, null as any)
		// biome-ignore lint/suspicious/noExplicitAny: Dummy handlers for spec generation only
		.openapi(analyticsRoutes.trends, null as any)
		// biome-ignore lint/suspicious/noExplicitAny: Dummy handlers for spec generation only
		.openapi(analyticsRoutes.genderAnalysis, null as any)
		// biome-ignore lint/suspicious/noExplicitAny: Dummy handlers for spec generation only
		.openapi(analyticsRoutes.genderAnalysisByLocation, null as any)
		// biome-ignore lint/suspicious/noExplicitAny: Dummy handlers for spec generation only
		.openapi(analyticsRoutes.generalAnalysis, null as any)
		// biome-ignore lint/suspicious/noExplicitAny: Dummy handlers for spec generation only
		.openapi(analyticsRoutes.safetyAnalysis, null as any)
		// biome-ignore lint/suspicious/noExplicitAny: Dummy handlers for spec generation only
		.openapi(analyticsRoutes.surveyLocations, null as any);

	const healthRouter = createRouter()
		// biome-ignore lint/suspicious/noExplicitAny: Dummy handlers for spec generation only
		.openapi(healthRoutes.health, null as any);

	return createApp()
		.route("/", healthRouter)
		.route("/v1/", cyclistRouter)
		.route("/v1/", analyticsRouter);
}

const app = createSpecApp();

/**
 * The name of this API service (used in the output filename)
 */
const API_NAME = "cyclist-profile";

/**
 * Get version from package.json
 */
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
				description: "API for managing cyclist profiles",
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
					name: "Cyclist Profiles",
					description: "Operations related to cyclist profiles",
				},
				{
					name: "Cyclist Analytics",
					description: "Analytics and insights for cyclist data",
				},
				{
					name: "System",
					description: "System operations",
				},
			],
		});

		const specJson = JSON.stringify(openAPIDoc, null, 2);

		// 1. Write to centralized specs directory (source of truth)
		const specsDir = path.resolve(__dirname, "../../../specs", API_NAME);
		fs.mkdirSync(specsDir, { recursive: true });
		const specsPath = path.join(specsDir, `v${version.split(".")[0]}.json`);
		fs.writeFileSync(specsPath, specJson);
		console.log(`✓ OpenAPI spec written to ${specsPath}`);

		// 2. Write to docs public directory (for serving)
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
		console.error("Error generating OpenAPI spec:", error);
		process.exit(1);
	}
}

generateOpenAPISpec();
