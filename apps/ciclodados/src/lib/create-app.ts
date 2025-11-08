import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { notFound, onError, serveEmojiFavicon } from "stoker/middlewares";
import { defaultHook } from "stoker/openapi";
import { createPinoLogger } from "../middlewares/pino-logger.js";

import type { AppBindings, AppOpenAPI } from "./types.js";

export function createRouter() {
	return new OpenAPIHono<AppBindings>({
		strict: false,
		defaultHook,
	});
}

export default function createApp(): OpenAPIHono<AppBindings> {
	const app: OpenAPIHono<AppBindings> = new OpenAPIHono<AppBindings>({
		strict: false,
		defaultHook,
	});

	app.use(cors());
	app.use(serveEmojiFavicon("🚀"));
	app.use(createPinoLogger());
	app.notFound(notFound);
	app.onError(onError);

	return app;
}

export function createTestApp<S extends import("hono").Schema>(router: AppOpenAPI<S>) {
	return createApp().route("/", router);
}
