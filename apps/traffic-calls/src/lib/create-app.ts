import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { notFound, onError, serveEmojiFavicon } from "stoker/middlewares";
import { defaultHook } from "stoker/openapi";
import { dbMiddleware } from "@atlas/database/workers-middleware";
import * as schema from "../db/schema.js";
import { createPinoLogger } from "../middlewares/pino-logger.js";

import type { AppBindings } from "./types.js";

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
	app.use(dbMiddleware(schema));
	app.use(serveEmojiFavicon("🚀"));
	app.use(createPinoLogger());
	app.notFound(notFound);
	app.onError(onError);

	return app;
}

export function createTestApp(
	// biome-ignore lint/suspicious/noExplicitAny: Required for Hono compatibility
	router: any,
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
