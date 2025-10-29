import { createRouter } from "../../lib/create-app.js";
import * as handlers from "./time-series.handlers.js";
import * as routes from "./time-series.routes.js";

const router = createRouter().openapi(
	routes.getTimeSeries,
	handlers.getTimeSeries,
);

export default router;
