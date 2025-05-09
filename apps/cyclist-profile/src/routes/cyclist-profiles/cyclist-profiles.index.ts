import { createRouter } from "../../lib/create-app.ts";

import * as handlers from "./cyclist-profiles.handlers.ts";
import * as routes from "./cyclist-profiles.routes.ts";

const router = createRouter()
	.openapi(routes.list, handlers.list)
	.openapi(routes.getOne, handlers.getOne);

export default router;
