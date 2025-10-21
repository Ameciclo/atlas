import { createRouter } from "../../lib/create-app.js";
import * as handlers from "./locations.handlers.js";
import * as routes from "./locations.routes.js";

const router = createRouter()
	.openapi(routes.list, handlers.list)
	.openapi(routes.getById, handlers.getById);

export default router;
