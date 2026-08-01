import { createRouter } from "../../lib/create-app.js";
import * as handlers from "./law-stats.handlers.js";
import * as routes from "./law-stats.routes.js";

const router = createRouter().openapi(routes.lawStatsRoute, handlers.lawStats);

export default router;
