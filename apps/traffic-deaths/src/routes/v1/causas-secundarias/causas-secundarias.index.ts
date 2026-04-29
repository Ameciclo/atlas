import { createRouter } from "../../../lib/create-app.js";
import * as handlers from "./causas-secundarias.handlers.js";
import * as routes from "./causas-secundarias.routes.js";

const router = createRouter().openapi(
	routes.getCausasSecundariasV1,
	handlers.getCausasSecundariasV1Handler,
);

export default router;
