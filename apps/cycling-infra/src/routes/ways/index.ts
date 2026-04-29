import { createRouter } from "../../lib/create-app.js";
import * as handlers from "./ways.handlers.js";
import * as routes from "./ways.routes.js";

const router = createRouter()
	.openapi(routes.list, handlers.list)
	.openapi(routes.getSummary, handlers.getSummary)
	.openapi(routes.getAll, handlers.getAll)
	.openapi(routes.getNearby, handlers.getNearby);

export default router;
