import path from "node:path";
import fs from "fs-extra";
import type { AppConfig } from "../create-app.js";
import { toPascalCase } from "../utils.js";

export async function generateSrcFiles(appPath: string, config: AppConfig) {
	const srcPath = path.join(appPath, "src");
	await fs.ensureDir(srcPath);

	// Generate index.ts
	await fs.writeFile(path.join(srcPath, "index.ts"), generateIndexFile(config));

	// Generate app.ts
	await fs.writeFile(path.join(srcPath, "app.ts"), generateAppFile(config));

	// Generate env.ts
	await fs.writeFile(path.join(srcPath, "env.ts"), generateEnvFile(config));

	// Generate generate-openapi.ts
	await fs.writeFile(
		path.join(srcPath, "generate-openapi.ts"),
		generateOpenApiFile(config),
	);

	// Generate lib files
	await generateLibFiles(srcPath, config);

	// Generate middlewares
	await generateMiddlewares(srcPath, config);

	// Generate routes
	await generateRoutes(srcPath, config);
}

function generateIndexFile(config: AppConfig): string {
	return `import { serve } from "@hono/node-server";
import app from "./app.js";

// Get port from environment variable or use ${config.port} as default
const port = Number.parseInt(process.env.PORT || "${config.port}", 10);

serve(
	{
		fetch: app.fetch,
		port,
	},
	(info) => {
		console.log(\`Server is running on http://localhost:\${info.port}\`);
	},
);
`;
}

function generateAppFile(config: AppConfig): string {
	return `import createApp from "./lib/create-app.js";
import healthRoutes from "./routes/health.js";
import exampleRoutes from "./routes/example/example.index.js";

const app = createApp()
	.route("/", healthRoutes)
	.route("/v1/", exampleRoutes);

export default app;
`;
}

function generateEnvFile(config: AppConfig): string {
	return `import { z } from "zod";

const EnvSchema = z.object({
	NODE_ENV: z.string().default("development"),
	LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
	PORT: z.coerce.number().default(${config.port}),${
		config.includeDatabase
			? `
	DATABASE_URL: z.string().optional(),
	DB_HOST: z.string().default("localhost"),
	DB_PORT: z.coerce.number().default(5432),
	DB_USER: z.string().default("postgres"),
	DB_PASSWORD: z.string().default("postgres"),
	DB_NAME: z.string().default("${config.databaseName}"),
	DB_SSL: z.string().default("false"),`
			: ""
	}
});

export type Env = z.infer<typeof EnvSchema>;

const env = EnvSchema.parse(process.env);

export default env;
`;
}

function generateOpenApiFile(config: AppConfig): string {
	return `import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import app from "./app.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateOpenAPISpec() {
	try {
		const openAPIDoc = app.getOpenAPIDocument({
			openapi: "3.1.0",
			info: {
				title: "${config.displayName} API",
				version: "1.0.0",
				description: "${config.description}",
				contact: {
					name: "Atlas Team",
					url: "https://github.com/Ameciclo/atlas",
				},
			},
			servers: [
				{
					url: \`http://localhost:\${process.env.PORT || "${config.port}"}\`,
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

		const outputPath = path.join(__dirname, "..", "openapi.json");
		await fs.writeFile(outputPath, JSON.stringify(openAPIDoc, null, 2));

		console.log(\`✓ OpenAPI spec generated at \${outputPath}\`);
	} catch (error) {
		console.error("Failed to generate OpenAPI spec:", error);
		process.exit(1);
	}
}

generateOpenAPISpec();
`;
}

async function generateLibFiles(srcPath: string, config: AppConfig) {
	const libPath = path.join(srcPath, "lib");
	await fs.ensureDir(libPath);

	// create-app.ts
	await fs.writeFile(
		path.join(libPath, "create-app.ts"),
		`import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { notFound, onError, serveEmojiFavicon } from "stoker/middlewares";
import { defaultHook } from "stoker/openapi";
import { createPinoLogger } from "../middlewares/pino-logger.js";

import type { AppBindings, AppOpenAPI } from "./types.js";

export function createRouter() {
	return new OpenAPIHono<AppBindings>({
		strict: false,
		defaultHook,
	});
}

export default function createApp(): OpenAPIHono<AppBindings> {
	const app: OpenAPIHono<AppBindings> = new OpenAPIHono<AppBindings>({
		strict: false,
		defaultHook,
	});

	app.use(cors());
	app.use(serveEmojiFavicon("🚀"));
	app.use(createPinoLogger());
	app.notFound(notFound);
	app.onError(onError);

	return app;
}

export function createTestApp<S extends import("hono").Schema>(router: AppOpenAPI<S>) {
	return createApp().route("/", router);
}
`,
	);

	// types.ts
	await fs.writeFile(
		path.join(libPath, "types.ts"),
		`import type { OpenAPIHono, RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { Schema } from "hono";
import type { PinoLogger } from "hono-pino";

export interface AppBindings {
	Variables: {
		logger: PinoLogger;
	};
}

// biome-ignore lint/complexity/noBannedTypes: <explanation>
export type AppOpenAPI<S extends Schema = {}> = OpenAPIHono<AppBindings, S>;

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<
	R,
	AppBindings
>;
`,
	);

	// constants.ts
	await fs.writeFile(
		path.join(libPath, "constants.ts"),
		`import * as HttpStatusPhrases from "stoker/http-status-phrases";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const ZOD_ERROR_MESSAGES = {
	REQUIRED: "Required",
	EXPECTED_NUMBER: "Expected number, received nan",
	NO_UPDATES: "No updates provided",
};

export const ZOD_ERROR_CODES = {
	INVALID_UPDATES: "invalid_updates",
};

export const notFoundSchema = createMessageObjectSchema(
	HttpStatusPhrases.NOT_FOUND,
);
`,
	);
}

async function generateMiddlewares(srcPath: string, config: AppConfig) {
	const middlewaresPath = path.join(srcPath, "middlewares");
	await fs.ensureDir(middlewaresPath);

	await fs.writeFile(
		path.join(middlewaresPath, "pino-logger.ts"),
		`import { pinoLogger } from "hono-pino";
import pino from "pino";
import type { LoggerOptions } from "pino";

export function createPinoLogger() {
	const opts: LoggerOptions = {
		level: process.env.LOG_LEVEL || "info",
		...(process.env.NODE_ENV === "production"
			? {}
			: {
					transport: {
						target: "pino-pretty",
						options: { colorize: true },
					},
				}),
	};

	const loggerInstance = pino.pino(opts);
	return pinoLogger({ pino: loggerInstance });
}
`,
	);
}

async function generateRoutes(srcPath: string, config: AppConfig) {
	const routesPath = path.join(srcPath, "routes");
	await fs.ensureDir(routesPath);

	// Health route
	await fs.writeFile(
		path.join(routesPath, "health.ts"),
		generateHealthRoute(config),
	);

	// Example routes
	const examplePath = path.join(routesPath, "example");
	await fs.ensureDir(examplePath);

	await fs.writeFile(
		path.join(examplePath, "example.routes.ts"),
		generateExampleRoutes(config),
	);

	await fs.writeFile(
		path.join(examplePath, "example.handlers.ts"),
		generateExampleHandlers(config),
	);

	await fs.writeFile(
		path.join(examplePath, "example.index.ts"),
		generateExampleIndex(config),
	);
}

function generateHealthRoute(config: AppConfig): string {
	return `import { createRoute, z } from "@hono/zod-openapi";
import { createRouter } from "../lib/create-app.js";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";${
		config.includeDatabase
			? `
import { db } from "../db/index.js";`
			: ""
	}

const healthSchema = z.object({
	status: z.enum(["ok", "error"]),
	timestamp: z.string(),
	service: z.string(),${
		config.includeDatabase
			? `
	database: z.enum(["connected", "disconnected"]),`
			: ""
	}
});

const healthRoute = createRoute({
	path: "/health",
	method: "get",
	tags: ["System"],
	responses: {
		[HttpStatusCodes.OK]: jsonContent(healthSchema, "Service is healthy"),
		[HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
			healthSchema,
			"Service is unhealthy",
		),
	},
});

const router = createRouter();

router.openapi(healthRoute, async (c) => {${
		config.includeDatabase
			? `
	let dbStatus: "connected" | "disconnected" = "connected";
	
	try {
		// Simple database check
		await db.execute("SELECT 1");
	} catch (error) {
		dbStatus = "disconnected";
		return c.json(
			{
				status: "error" as const,
				timestamp: new Date().toISOString(),
				service: "${config.name}",
				database: dbStatus,
			},
			HttpStatusCodes.SERVICE_UNAVAILABLE,
		);
	}

	return c.json({
		status: "ok" as const,
		timestamp: new Date().toISOString(),
		service: "${config.name}",
		database: dbStatus,
	});`
			: `
	return c.json({
		status: "ok" as const,
		timestamp: new Date().toISOString(),
		service: "${config.name}",
	});`
	}
});

export default router;
`;
}

function generateExampleRoutes(config: AppConfig): string {
	return `import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const tags = ["Example"];

const exampleSchema = z.object({
	id: z.number(),
	message: z.string(),
	timestamp: z.string(),
});

export const list = createRoute({
	path: "/examples",
	method: "get",
	tags,
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.array(exampleSchema),
			"List of examples",
		),
	},
});

export type ListRoute = typeof list;
`;
}

function generateExampleHandlers(config: AppConfig): string {
	return `import type { AppRouteHandler } from "../../lib/types.js";
import type * as routes from "./example.routes.js";

export const list: AppRouteHandler<routes.ListRoute> = async (c) => {
	return c.json([
		{
			id: 1,
			message: "Hello from ${config.displayName}!",
			timestamp: new Date().toISOString(),
		},
	]);
};
`;
}

function generateExampleIndex(config: AppConfig): string {
	return `import { createRouter } from "../../lib/create-app.js";
import * as handlers from "./example.handlers.js";
import * as routes from "./example.routes.js";

const router = createRouter().openapi(routes.list, handlers.list);

export default router;
`;
}
