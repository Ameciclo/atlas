import { createRouter } from "../../lib/create-app.js";
import * as handlers from "./analytics.handlers.js";
import * as routes from "./analytics.routes.js";

const router = createRouter()
	.openapi(routes.municipalityStats, handlers.municipalityStats)
	.openapi(routes.accidentTypes, handlers.accidentTypes)
	.openapi(routes.genderDistribution, handlers.genderDistribution)
	.openapi(routes.dangerousStreets, handlers.dangerousStreets);

export default router;
