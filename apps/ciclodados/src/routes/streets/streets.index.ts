import type { AppOpenAPI } from "../../lib/types.js";
import { OpenAPIHono } from "@hono/zod-openapi";
import { searchStreetsRoute, getStreetDetailsRoute } from "./streets.routes.js";
import { searchStreets, getStreetDetails } from "./streets.handlers.js";
import { handleStreetDataSummary } from "./data-summary.handler.js";

const app: AppOpenAPI = new OpenAPIHono();

app.openapi(searchStreetsRoute, searchStreets);
app.openapi(getStreetDetailsRoute, getStreetDetails);
app.get("/streets/:streetId/data-summary", handleStreetDataSummary);

export default app;
