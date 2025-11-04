import { createRouter } from "../../lib/create-app.js";
import { listStreetsRoute, getStreetRoute } from "./streets.routes.js";
import { listStreets, getStreet } from "./streets.handlers.js";

const streetsRouter = createRouter()
	.openapi(listStreetsRoute, listStreets)
	.openapi(getStreetRoute, getStreet);

export default streetsRouter;
