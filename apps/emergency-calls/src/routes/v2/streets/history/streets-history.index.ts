import { createRouter } from "../../../../lib/create-app.js";
import * as handlers from "./streets-history.handlers.js";
import * as routes from "./streets-history.routes.js";

const router = createRouter().openapi(
	routes.streetsHistory,
	handlers.streetsHistory,
);

export default router;
