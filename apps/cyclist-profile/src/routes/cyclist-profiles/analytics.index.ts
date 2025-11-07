import { createRouter } from "../../lib/create-app.js";

import * as handlers from "./analytics.handlers.js";
import * as routes from "./analytics.routes.js";

const router = createRouter()
	.openapi(routes.summary, handlers.summary)
	.openapi(routes.trends, handlers.trends)
	.openapi(routes.genderAnalysis, handlers.genderAnalysis)
	.openapi(routes.safetyAnalysis, handlers.safetyAnalysis)
	.openapi(routes.surveyLocations, handlers.surveyLocations);

export default router;