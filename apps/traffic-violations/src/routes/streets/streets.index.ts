import { createRouter } from "../../lib/create-app.js";
import {
	getStreet,
	listStreets,
	neighborhoods,
	streetSummary,
	streetsGeoJSON,
	streetsRanking,
	streetViolations,
} from "./streets.handlers.js";
import {
	getStreetRoute,
	listStreetsRoute,
	neighborhoodsRoute,
	streetSummaryRoute,
	streetsGeoJSONRoute,
	streetsRankingRoute,
	streetViolationsRoute,
} from "./streets.routes.js";
import { VALIDATION_HTML, validationPageRoute } from "./validation-page.js";

const streetsRouter = createRouter()
	.openapi(listStreetsRoute, listStreets)
	.openapi(streetsGeoJSONRoute, streetsGeoJSON)
	.openapi(streetsRankingRoute, streetsRanking)
	.openapi(neighborhoodsRoute, neighborhoods)
	.openapi(getStreetRoute, getStreet)
	.openapi(streetSummaryRoute, streetSummary)
	.openapi(streetViolationsRoute, streetViolations)
	.openapi(validationPageRoute, (c) => {
		return c.html(VALIDATION_HTML);
	});

export default streetsRouter;
