import { createRouter } from "../../lib/create-app.js";
import {
  listStreetsRoute,
  getStreetRoute,
  streetsRankingRoute,
  streetSummaryRoute,
  streetViolationsRoute,
  neighborhoodsRoute,
} from "./streets.routes.js";
import {
  listStreets,
  getStreet,
  streetsRanking,
  streetSummary,
  streetViolations,
  neighborhoods,
} from "./streets.handlers.js";
import matchingRouter from "./matching.index.js";
import { validationPageRoute, VALIDATION_HTML } from "./validation-page.js";

const streetsRouter = createRouter()
  .openapi(listStreetsRoute, listStreets)
  .openapi(getStreetRoute, getStreet)
  .openapi(streetsRankingRoute, streetsRanking)
  .openapi(streetSummaryRoute, streetSummary)
  .openapi(streetViolationsRoute, streetViolations)
  .openapi(neighborhoodsRoute, neighborhoods)
  .openapi(validationPageRoute, (c) => {
    return c.html(VALIDATION_HTML);
  })
  .route("/", matchingRouter);

export default streetsRouter;
