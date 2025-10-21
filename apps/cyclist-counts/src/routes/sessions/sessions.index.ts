import { createRouter } from "../../lib/create-app.js";
import * as handlers from "./sessions.handlers.js";
import * as routes from "./sessions.routes.js";

const router = createRouter()
	.openapi(routes.getByEventId, handlers.getByEventId)
	.openapi(routes.getById, handlers.getById);

export default router;

