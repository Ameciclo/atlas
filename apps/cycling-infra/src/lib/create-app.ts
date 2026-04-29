import { OpenAPIHono } from "@hono/zod-openapi";
import { dbMiddleware } from "@atlas/database/workers-middleware";
import { cors } from "hono/cors";
import { compress } from "hono/compress";
import { notFound, onError, serveEmojiFavicon } from "stoker/middlewares";
import { defaultHook } from "stoker/openapi";
import * as schema from "../db/schema.js";
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

	app.use(compress());
	app.use(cors());
	app.use(serveEmojiFavicon("🚀"));
	app.use(dbMiddleware(schema));
	app.use(createPinoLogger());
	app.notFound(notFound);
	app.onError(onError);

	return app;
}

export function createTestApp<S extends import("hono").Schema>(
	router: AppOpenAPI<S>,
	db?: unknown,
) {
	const outer = new OpenAPIHono<AppBindings>({ strict: false, defaultHook });
	if (db !== undefined) {
		outer.use(async (c, next) => {
			c.set("db", db as never);
			await next();
		});
	}
	return outer.route("/", createApp().route("/", router));
}
