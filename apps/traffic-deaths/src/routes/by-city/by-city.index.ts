import { createRouter } from "../../lib/create-app.js";
import * as handlers from "./by-city.handlers.js";
import * as routes from "./by-city.routes.js";

const router = createRouter().openapi(
	routes.getDeathsByCity,
	handlers.getDeathsByCity,
);

export default router;
