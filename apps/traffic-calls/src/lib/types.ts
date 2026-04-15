import type { Context } from "hono";
import type { Handler } from "hono";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "../db/schema.js";

export interface AppBindings {
	Bindings: {
		HYPERDRIVE?: { connectionString: string };
		DATABASE_URL?: string;
	};
	Variables: {
		db: NodePgDatabase<typeof schema>;
	};
}

// biome-ignore lint/suspicious/noExplicitAny: Required for Hono handler compatibility
export type AppHandler = Handler<any, any, any, any>;

// biome-ignore lint/suspicious/noExplicitAny: Required for Hono context compatibility
export type AppContext = Context<any, any, any>;

// biome-ignore lint/suspicious/noExplicitAny: Required for Hono OpenAPI compatibility
export type AppOpenAPI = any;
