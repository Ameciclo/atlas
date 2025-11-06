import { createRouter } from "../../lib/create-app.js";
import * as handlers from "./summary.handlers.js";
import * as routes from "./summary.routes.js";

const router = createRouter()
	.openapi(routes.getSummary, handlers.getSummaryHandler);

export default router;