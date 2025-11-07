import { createRouter } from "../../../lib/create-app.js";
import * as handlers from "./filtros.handlers.js";
import * as routes from "./filtros.routes.js";

const router = createRouter()
	.openapi(routes.getFiltrosV1, handlers.getFiltrosV1Handler);

export default router;