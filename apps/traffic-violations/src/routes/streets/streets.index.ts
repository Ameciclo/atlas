import { createRouter } from "../../lib/create-app.js";
import matchingRouter from "./matching.index.js";
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
	// Specific literal paths must come before parameterized ones
	.openapi(listStreetsRoute, listStreets)
	.openapi(streetsGeoJSONRoute, streetsGeoJSON)
	.openapi(streetsRankingRoute, streetsRanking)
	.openapi(neighborhoodsRoute, neighborhoods)
	// Parameterized routes
	.openapi(getStreetRoute, getStreet)
	.openapi(streetSummaryRoute, streetSummary)
	.openapi(streetViolationsRoute, streetViolations)
	.openapi(validationPageRoute, (c) => {
		return c.html(VALIDATION_HTML);
	})
	.route("/", matchingRouter);

export default streetsRouter;
