import { createRouter } from "../../lib/create-app.js";
import * as handlers from "./events.handlers.js";
import * as routes from "./events.routes.js";

const router = createRouter()
	.openapi(routes.list, handlers.list)
	.openapi(routes.getById, handlers.getById)
	.openapi(routes.getByLocationId, handlers.getByLocationId);

export default router;
