import { createRouter } from "../../lib/create-app.js";

import * as handlers from "./categories.handlers.js";
import * as routes from "./categories.routes.js";

const router = createRouter().openapi(routes.list, handlers.list);

export default router;
