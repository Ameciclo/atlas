import { createRouter } from "../../lib/create-app.js";
import * as handlers from "./points.handlers.js";
import * as routes from "./points.routes.js";

const router = createRouter()
	.openapi(routes.list, handlers.list)
	.openapi(routes.geojson, handlers.geojson);

export default router;
