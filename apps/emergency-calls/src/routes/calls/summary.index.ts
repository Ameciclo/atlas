import { createRouter } from "../../lib/create-app.js";
import * as handlers from "./summary.handlers.js";
import * as routes from "./summary.routes.js";

const router = createRouter()
	.openapi(routes.summary, handlers.summary)
	.openapi(routes.cities, handlers.cities)
	.openapi(routes.cityStats, handlers.cityStats)
	.openapi(routes.outcomes, handlers.outcomes)
	.openapi(routes.profiles, handlers.profiles);

export default router;
