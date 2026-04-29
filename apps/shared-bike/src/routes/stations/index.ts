import { createRouter } from "../../lib/create-app.js";
import {
	listStationsRoute,
	getStationRoute,
	nearbyStationsRoute,
} from "./stations.routes.js";
import {
	listStations,
	getStation,
	nearbyStations,
} from "./stations.handlers.js";

const router = createRouter()
	.openapi(listStationsRoute, listStations as any)
	.openapi(nearbyStationsRoute, nearbyStations as any)
	.openapi(getStationRoute, getStation as any);

export default router;
