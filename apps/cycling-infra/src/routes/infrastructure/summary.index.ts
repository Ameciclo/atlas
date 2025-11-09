import { createRouter } from "../../lib/create-app.js";
import * as handlers from "./summary.handlers.js";
import * as routes from "./summary.routes.js";

const router = createRouter()
	.openapi(routes.summary, handlers.summary)
	.openapi(routes.cycleways, handlers.cycleways)
	.openapi(routes.cityCoverage, handlers.cityCoverage)
	.openapi(routes.citySpecificSummary, handlers.citySpecificSummary);

export default router;
