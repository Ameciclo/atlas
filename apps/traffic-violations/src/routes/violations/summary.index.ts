import { createRouter } from "../../lib/create-app.js";
import * as handlers from "./summary.handlers.js";
import * as routes from "./summary.routes.js";

const router = createRouter()
	.openapi(routes.summary, handlers.summary)
	.openapi(routes.byType, handlers.byType)
	.openapi(routes.byAgent, handlers.byAgent)
	.openapi(routes.temporalAnalysis, handlers.temporalAnalysis);

export default router;