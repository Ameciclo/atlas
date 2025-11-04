import { createRouter } from "../../lib/create-app.js";
import { listViolationsRoute, getViolationRoute } from "./violations.routes.js";
import {
	listViolationsHandler,
	getViolationHandler,
} from "./violations.handlers.js";

// ============================================================================
// Router
// ============================================================================

const violationsRouter = createRouter()
	.openapi(listViolationsRoute, listViolationsHandler)
	.openapi(getViolationRoute, getViolationHandler);

export default violationsRouter;
