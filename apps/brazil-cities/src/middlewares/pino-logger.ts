import { pinoLogger } from "hono-pino";
import pino from "pino";
import type { LoggerOptions } from "pino";

export function createPinoLogger() {
	const opts: LoggerOptions = {
		level: process.env.LOG_LEVEL || "info",
		...(process.env.NODE_ENV === "production"
			? {}
			: {
					transport: {
						target: "pino-pretty",
						options: { colorize: true },
					},
				}),
	};

	const loggerInstance = pino.pino(opts);
	return pinoLogger({ pino: loggerInstance });
}
