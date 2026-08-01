import { createRouter } from "../../lib/create-app.js";
import {
	listStreets,
	streetsGeoJSON,
	streetsNearby,
} from "./streets.handlers.js";
import {
	listStreetsRoute,
	streetsGeoJSONRoute,
	streetsNearbyRoute,
} from "./streets.routes.js";

const streetsRouter = createRouter()
	.openapi(listStreetsRoute, listStreets)
	.openapi(streetsNearbyRoute, streetsNearby)
	.openapi(streetsGeoJSONRoute, streetsGeoJSON);

export default streetsRouter;
