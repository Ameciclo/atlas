import type { RouteHandler } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { AppBindings } from "../lib/types.ts";
import type { HealthRoute } from "./health.routes.ts";

export const health: RouteHandler<HealthRoute, AppBindings> = async (c) => {
	return c.json({
		status: "ok",
		service: "cyclist-profile"
	}, HttpStatusCodes.OK);
};