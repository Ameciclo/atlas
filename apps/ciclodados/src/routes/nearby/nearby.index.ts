import { OpenAPIHono } from "@hono/zod-openapi";
import { nearbyRoute } from "./nearby.routes.js";
import { nearbyHandler } from "./nearby.handlers.js";

const app = new OpenAPIHono();

app.openapi(nearbyRoute, nearbyHandler);

export default app;