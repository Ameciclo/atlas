import { createRouter } from "../../../lib/create-app.js";
import * as handlers from "./matrix.handlers.js";
import * as routes from "./matrix.routes.js";

const router = createRouter().openapi(
	routes.getMatrixV1,
	handlers.getMatrixV1Handler,
);

export default router;
