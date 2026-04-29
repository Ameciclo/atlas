import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createMiddleware } from "hono/factory";
import { getSSLConfig } from "./connection.js";

/**
 * Detects if we're running inside Cloudflare Workers.
 * Workers have `caches` on globalThis but no `process.versions.node`.
 */
function isWorkersRuntime(): boolean {
	return (
		typeof (globalThis as Record<string, unknown>).caches !== "undefined" &&
		typeof (globalThis as Record<string, unknown>).process === "undefined"
	);
}

/**
 * Hono middleware that creates a Drizzle database instance per-request
 * and puts it on the context as `c.get("db")`.
 *
 * - On Cloudflare Workers: uses `c.env.HYPERDRIVE.connectionString` (SSL handled by Hyperdrive)
 * - On Node.js (local dev): uses `process.env.DATABASE_URL` with SSL config
 */
// biome-ignore lint/suspicious/noExplicitAny: middleware must be compatible with any app bindings
export function dbMiddleware<T extends Record<string, unknown> = Record<string, unknown>>(schema: T): any {
	return createMiddleware(async (c, next) => {
		// If a db is already set on the context (e.g. by tests), skip creating a new one.
		if (c.get("db" as never) !== undefined) {
			await next();
			return;
		}

		let connectionString: string;
		let ssl: ReturnType<typeof getSSLConfig> | false = false;

		if (isWorkersRuntime()) {
			// Cloudflare Workers: Hyperdrive provides the connection string
			// Hyperdrive handles TLS to the origin database, so ssl: false is correct
			const hyperdrive = (c.env as Record<string, unknown>)
				?.HYPERDRIVE as { connectionString: string } | undefined;
			connectionString =
				hyperdrive?.connectionString ??
				((c.env as Record<string, string>)?.DATABASE_URL || "");
		} else {
			// Node.js (local dev): use process.env and SSL config
			connectionString = process.env.DATABASE_URL || "";
			ssl = getSSLConfig();
		}

		const db = drizzle({
			connection: {
				connectionString,
				ssl,
			},
			schema,
		});

		c.set("db", db as NodePgDatabase<T>);
		await next();
	});
}
