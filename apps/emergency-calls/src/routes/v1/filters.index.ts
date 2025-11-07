import { createRouter } from "../../lib/create-app.js";
import * as handlers from "./filters.handlers.js";
import * as routes from "./filters.routes.js";

const router = createRouter()
	.openapi(routes.filters, handlers.filters);

export default router;