import { createRouter } from "../../lib/create-app.js";
import * as handlers from "./downloads.handlers.js";
import * as routes from "./downloads.routes.js";

const router = createRouter().openapi(
	routes.aggregateCsv,
	handlers.aggregateCsv,
);

export default router;
