import type { AppOpenAPI } from "../../lib/types.js";
import { OpenAPIHono } from "@hono/zod-openapi";
import { analyzePointRoute } from "./analyze.routes.js";
import { analyzePoint } from "./analyze.handlers.js";

const app: AppOpenAPI = new OpenAPIHono();

app.openapi(analyzePointRoute, analyzePoint);

export default app;