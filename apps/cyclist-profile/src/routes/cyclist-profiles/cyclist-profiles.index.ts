import { createRouter } from "../../lib/create-app.js";

import * as handlers from "./cyclist-profiles.handlers.js";
import * as routes from "./cyclist-profiles.routes.js";

const router = createRouter()
	.openapi(routes.list, handlers.list)
	.openapi(routes.getOne, handlers.getOne)
	.openapi(routes.nearby, handlers.nearby)
	.openapi(routes.nearbySummary, handlers.nearbySummary);

export default router;
