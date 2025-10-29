import { createRouter } from "../../lib/create-app.js";
import { listCallsRoute, getCallRoute } from "./calls.routes.js";
import { listCallsHandler, getCallHandler } from "./calls.handlers.js";

const router = createRouter()
	.openapi(listCallsRoute, listCallsHandler)
	.openapi(getCallRoute, getCallHandler);

export default router;