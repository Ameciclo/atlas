import { createRouter } from "../../lib/create-app.js";
import * as handlers from "./dashboard.handlers.js";
import * as routes from "./dashboard.routes.js";

const router = createRouter()
	.openapi(routes.overviewRoute, handlers.overview)
	.openapi(routes.violationCodesRoute, handlers.violationCodes);

export default router;
