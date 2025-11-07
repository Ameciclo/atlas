import { createRouter } from "../../../lib/create-app.js";
import * as handlers from "./unsafe-streets.handlers.js";
import * as routes from "./unsafe-streets.routes.js";

const router = createRouter()
	.openapi(routes.citySummary, handlers.citySummary)
	.openapi(routes.cityConcentration, handlers.cityConcentration)
	.openapi(routes.cityGeoJSON, handlers.cityGeoJSON)
	.openapi(routes.streetSummary, handlers.streetSummary)
	.openapi(routes.streetProfiles, handlers.streetProfiles)
	.openapi(routes.streetGeoJSON, handlers.streetGeoJSON)
	.openapi(routes.streetEvolution, handlers.streetEvolution)
	.openapi(routes.streetRecords, handlers.streetRecords);

export default router;