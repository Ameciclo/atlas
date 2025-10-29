import { createRouter } from "../../lib/create-app.js";
import { listCallsRoute, getCallRoute } from "./calls.routes.js";
import { listCallsHandler, getCallHandler } from "./calls.handlers.js";

const router = createRouter()
	// biome-ignore lint/suspicious/noExplicitAny: Required for Hono OpenAPI compatibility
	.openapi(listCallsRoute, listCallsHandler as any)
	// biome-ignore lint/suspicious/noExplicitAny: Required for Hono OpenAPI compatibility
	.openapi(getCallRoute, getCallHandler as any);

export default router;
