import type { OpenAPIHono, RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Schema } from "hono";
import type { PinoLogger } from "hono-pino";
import type * as schema from "../db/schema.js";

export interface AppBindings {
	Bindings: {
		HYPERDRIVE?: { connectionString: string };
		DATABASE_URL?: string;
	};
	Variables: {
		logger: PinoLogger;
		db: NodePgDatabase<typeof schema>;
	};
}

// biome-ignore lint/complexity/noBannedTypes: OpenAPIHono requires generic types
export type AppOpenAPI<S extends Schema = {}> = OpenAPIHono<AppBindings, S>;

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<
	R,
	AppBindings
>;
