import { createRouter } from "../../lib/create-app.js";
import * as handlers from "./cyclists.handlers.js";
import * as routes from "./cyclists.routes.js";

const router = createRouter().openapi(
	routes.getCyclistDeaths,
	handlers.getCyclistDeaths,
);

export default router;
