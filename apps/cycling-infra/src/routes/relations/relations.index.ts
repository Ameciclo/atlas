import { createRouter } from "../../lib/create-app.js";
import * as handlers from "./relations.handlers.js";
import * as routes from "./relations.routes.js";
import { relationsByCity } from "./relations-by-city.handlers";
import { relationsByCityRoute } from "./relations-by-city.routes";

const router = createRouter()
	.openapi(routes.list, handlers.list)
	.openapi(routes.getWaysByRelationId, handlers.getWaysByRelationId)
	.openapi(relationsByCityRoute, relationsByCity);

export default router;