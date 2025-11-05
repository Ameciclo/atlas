import { createRouter } from "../../lib/create-app.js";
import { listStationsRoute, getStationRoute } from "./stations.routes.js";
import { listStations, getStation } from "./stations.handlers.js";

const router = createRouter()
	.openapi(listStationsRoute, listStations)
	.openapi(getStationRoute, getStation);

export default router;
