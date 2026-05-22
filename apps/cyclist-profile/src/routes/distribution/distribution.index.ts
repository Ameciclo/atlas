import { createRouter } from "../../lib/create-app.js";
import * as handlers from "./distribution.handlers.js";
import * as routes from "./distribution.routes.js";

const router = createRouter().openapi(routes.query, handlers.query);

export default router;
