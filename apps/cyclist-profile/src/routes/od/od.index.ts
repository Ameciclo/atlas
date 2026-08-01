import { createRouter } from "../../lib/create-app.js";
import * as handlers from "./od.handlers.js";
import * as routes from "./od.routes.js";

const router = createRouter()
	.openapi(routes.matrix, handlers.matrix)
	.openapi(routes.flows, handlers.flows);

export default router;
