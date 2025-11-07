import { createRouter } from "../../lib/create-app.js";
import { listStationsRoute, getStationRoute, nearbyStationsRoute } from "./stations.routes.js";
import { listStations, getStation, nearbyStations } from "./stations.handlers.js";

const router = createRouter()
	.openapi(listStationsRoute, listStations)
	.openapi(nearbyStationsRoute, nearbyStations)
	.openapi(getStationRoute, getStation);

export default router;
