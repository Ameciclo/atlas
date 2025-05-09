import { OpenAPIHono } from "@hono/zod-openapi";
import { notFound, onError, serveEmojiFavicon } from "stoker/middlewares";
import { defaultHook } from "stoker/openapi";
import { createPinoLogger } from "../middlewares/pino-logger.ts";

export function createRouter() {
	return new OpenAPIHono({
		strict: false,
		defaultHook,
	});
}

export default function createApp() {
	return new OpenAPIHono()
		.use(serveEmojiFavicon("☀️"))
		.use(createPinoLogger())
		.notFound(notFound)
		.onError(onError);
}
