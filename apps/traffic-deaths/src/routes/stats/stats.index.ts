import { createRouter } from "../../lib/create-app.js";
import * as handlers from "./stats.handlers.js";
import * as routes from "./stats.routes.js";

const router = createRouter().openapi(routes.getStats, handlers.getStats);

export default router;
