import { createRouter } from "../../lib/create-app.js";
import {
	batchMatchHandler,
	confirmValidationHandler,
	listValidationsHandler,
	matchLocationHandler,
	matchStatsHandler,
	rejectValidationHandler,
} from "./matching.handlers.js";
import {
	batchMatchRoute,
	confirmValidationRoute,
	listValidationsRoute,
	matchLocationRoute,
	matchStatsRoute,
	rejectValidationRoute,
} from "./matching.routes.js";

const matchingRouter = createRouter()
	.openapi(matchLocationRoute, matchLocationHandler)
	.openapi(batchMatchRoute, batchMatchHandler)
	.openapi(matchStatsRoute, matchStatsHandler)
	.openapi(listValidationsRoute, listValidationsHandler)
	.openapi(confirmValidationRoute, confirmValidationHandler)
	.openapi(rejectValidationRoute, rejectValidationHandler);

export default matchingRouter;
