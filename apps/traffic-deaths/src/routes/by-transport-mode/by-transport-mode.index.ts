import { createRouter } from "../../lib/create-app.js";
import * as handlers from "./by-transport-mode.handlers.js";
import * as routes from "./by-transport-mode.routes.js";

const router = createRouter().openapi(
	routes.getDeathsByTransportMode,
	handlers.getDeathsByTransportMode,
);

export default router;
