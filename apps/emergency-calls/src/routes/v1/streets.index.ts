import { createRouter } from "../../lib/create-app.js";
import * as handlers from "./streets.handlers.js";
import * as routes from "./streets.routes.js";

const router = createRouter()
	.openapi(routes.streetsSummary, handlers.streetsSummary)
	.openapi(routes.streetsTop, handlers.streetsTop)
	.openapi(routes.streetsSearch, handlers.streetsSearch)
	.openapi(routes.streetsHistory, handlers.streetsHistory);

export default router;
