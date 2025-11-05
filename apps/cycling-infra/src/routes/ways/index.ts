import { createRouter } from "../../lib/create-app.js";
import { listWaysRoute, getWaysSummaryRoute, getAllWaysGeoJSONRoute } from "./ways.routes.js";
import { listWays, getWaysSummary, getAllWaysGeoJSON } from "./ways.handlers.js";

export const waysRoutes = createRouter()
  .openapi(listWaysRoute, listWays)
  .openapi(getWaysSummaryRoute, getWaysSummary)
  .openapi(getAllWaysGeoJSONRoute, getAllWaysGeoJSON);