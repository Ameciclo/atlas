import { createRouter } from "../../lib/create-app.js";
import {
  matchLocationRoute,
  batchMatchRoute,
  matchStatsRoute,
  listValidationsRoute,
  confirmValidationRoute,
  rejectValidationRoute,
} from "./matching.routes.js";
import {
  matchLocationHandler,
  batchMatchHandler,
  matchStatsHandler,
  listValidationsHandler,
  confirmValidationHandler,
  rejectValidationHandler,
} from "./matching.handlers.js";

const matchingRouter = createRouter()
  .openapi(matchLocationRoute, matchLocationHandler)
  .openapi(batchMatchRoute, batchMatchHandler)
  .openapi(matchStatsRoute, matchStatsHandler)
  .openapi(listValidationsRoute, listValidationsHandler)
  .openapi(confirmValidationRoute, confirmValidationHandler)
  .openapi(rejectValidationRoute, rejectValidationHandler);

export default matchingRouter;
