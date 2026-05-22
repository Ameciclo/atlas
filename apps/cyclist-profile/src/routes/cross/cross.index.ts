import { createRouter } from "../../lib/create-app.js";

import * as handlers from "./cross.handlers.js";
import * as routes from "./cross.routes.js";

const router = createRouter().openapi(routes.query, handlers.query);

export default router;
