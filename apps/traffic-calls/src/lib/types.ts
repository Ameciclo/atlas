import type { Context } from "hono";
import type { Handler } from "hono";

// biome-ignore lint/suspicious/noExplicitAny: Required for Hono handler compatibility
export type AppHandler = Handler<any, any, any, any>;

// biome-ignore lint/suspicious/noExplicitAny: Required for Hono context compatibility
export type AppContext = Context<any, any, any>;

// biome-ignore lint/suspicious/noExplicitAny: Required for Hono bindings compatibility
export type AppBindings = any;

// biome-ignore lint/suspicious/noExplicitAny: Required for Hono OpenAPI compatibility
export type AppOpenAPI = any;
