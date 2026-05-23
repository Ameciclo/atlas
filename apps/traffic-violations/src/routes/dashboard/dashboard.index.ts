import { createRouter } from "../../lib/create-app.js";
import * as handlers from "./dashboard.handlers.js";
import * as routes from "./dashboard.routes.js";

const router = createRouter()
	.openapi(routes.overviewRoute, handlers.overview)
	.openapi(routes.topViolationsRoute, handlers.topViolations)
	.openapi(routes.topStreetsRoute, handlers.topStreets)
	.openapi(routes.temporalRoute, handlers.temporal)
	.openapi(routes.agentAnalysisRoute, handlers.agentAnalysis)
	.openapi(routes.violationCodesRoute, handlers.violationCodes)
	.openapi(routes.categoriesListRoute, handlers.categoriesList)
	.openapi(routes.geojsonRoute, handlers.geojson);

export default router;
