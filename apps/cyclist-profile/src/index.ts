import { serve } from "@hono/node-server";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "./db/index.js";
import { cyclistProfiles } from "./db/schema.js";

export const app = new Hono()
	.get("/", async (c) => {
		try {
			const cyclistProfiles = await db.query.cyclistProfiles.findMany();
			return c.json(cyclistProfiles);
		} catch (queryError) {
			console.error("Database query error:", queryError);
			return c.json(
				{ error: "Failed to fetch cyclist profiles. Database error." },
				{ status: 500 },
			);
		}
	})
	.get("/:id", async (c) => {
		const id = Number(c.req.param("id"));
		const profile = await db.query.cyclistProfiles.findFirst({
			where: eq(cyclistProfiles.id, id),
		});

		if (!profile) return c.json({ error: "Not found" }, 404);
		return c.json(profile);
	})
	.get("/health", () => new Response("OK", { status: 200 }));

serve(
	{
		fetch: app.fetch,
		port: 3000,
	},
	(info) => {
		console.log(`Server is running on http://localhost:${info.port}`);
	},
);
