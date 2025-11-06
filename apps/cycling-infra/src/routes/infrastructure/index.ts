import { createRouter } from "../../lib/create-app.js";
import * as handlers from "./infrastructure.handlers.js";
import * as routes from "./infrastructure.routes.js";

const router = createRouter()
	.openapi(routes.list, handlers.list)
	.openapi(routes.getById, handlers.getById);

export default router;
