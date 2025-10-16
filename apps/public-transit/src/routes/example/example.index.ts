import { createRouter } from "../../lib/create-app.js";
import * as handlers from "./example.handlers.js";
import * as routes from "./example.routes.js";

const router = createRouter().openapi(routes.list, handlers.list);

export default router;
