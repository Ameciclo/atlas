import { createRouter } from "../../lib/create-app.js";
import * as handlers from "./street-stats.handlers.js";
import * as routes from "./street-stats.routes.js";

const router = createRouter().openapi(
	routes.streetStatsRoute,
	handlers.streetStats,
);

export default router;
