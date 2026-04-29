import { createRouter } from "../../lib/create-app.js";
import {
	listViolationsRoute,
	getViolationRoute,
	violationsByLocationRoute,
	violationsHotspotsRoute,
	violationsGeoJSONRoute,
} from "./violations.routes.js";
import {
	listViolationsHandler,
	getViolationHandler,
	violationsByLocationHandler,
	violationsHotspotsHandler,
	violationsGeoJSONHandler,
} from "./violations.handlers.js";

// ============================================================================
// Router
// ============================================================================

const violationsRouter = createRouter()
	.openapi(listViolationsRoute, listViolationsHandler)
	.openapi(violationsByLocationRoute, violationsByLocationHandler)
	.openapi(violationsHotspotsRoute, violationsHotspotsHandler)
	.openapi(violationsGeoJSONRoute, violationsGeoJSONHandler)
	.openapi(getViolationRoute, getViolationHandler);

export default violationsRouter;
