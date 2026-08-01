import { createRouter } from "../../lib/create-app.js";

import * as handlers from "./dictionary.handlers.js";
import * as routes from "./dictionary.routes.js";

const router = createRouter().openapi(routes.list, handlers.list);

export default router;
