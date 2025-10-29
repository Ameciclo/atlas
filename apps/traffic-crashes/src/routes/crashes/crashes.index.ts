import { createRouter } from "../../lib/create-app.js";
import * as handlers from "./crashes.handlers.js";
import * as routes from "./crashes.routes.js";

const router = createRouter()
	.openapi(routes.list, handlers.list)
	.openapi(routes.getById, handlers.getById);

export default router;