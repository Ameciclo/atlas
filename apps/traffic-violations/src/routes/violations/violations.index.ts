import { createRouter } from "../../lib/create-app.js";
import {
	getViolationHandler,
	listViolationsHandler,
	violationsByLocationHandler,
} from "./violations.handlers.js";
import {
	getViolationRoute,
	listViolationsRoute,
	violationsByLocationRoute,
} from "./violations.routes.js";

// ============================================================================
// Router
// ============================================================================

const violationsRouter = createRouter()
	.openapi(listViolationsRoute, listViolationsHandler)
	.openapi(violationsByLocationRoute, violationsByLocationHandler)
	.openapi(getViolationRoute, getViolationHandler);

export default violationsRouter;
