import { createRouter } from "../../../lib/create-app.js";
import * as handlers from "./cities-by-year.handlers.js";
import * as routes from "./cities-by-year.routes.js";

const router = createRouter()
	.openapi(routes.getCitiesByYearV1, handlers.getCitiesByYearV1Handler);

export default router;