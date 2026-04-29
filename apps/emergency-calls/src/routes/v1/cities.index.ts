import { createRouter } from "../../lib/create-app.js";
import * as handlers from "./cities.handlers.js";
import * as routes from "./cities.routes.js";

const router = createRouter().openapi(routes.cities, handlers.cities);

export default router;
