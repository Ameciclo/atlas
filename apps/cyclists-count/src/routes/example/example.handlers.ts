import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { cyclistsCounts } from "../../db/schema.js";
import type { AppRouteHandler } from "../../lib/types.js";
import type * as routes from "./example.routes.js";

export const list: AppRouteHandler<routes.ListRoute> = async (c) => {
	const counts = await db.select().from(cyclistsCounts);
	return c.json(counts);
};

export const getById: AppRouteHandler<routes.GetByIdRoute> = async (c) => {
	const { id } = c.req.valid("param");
	const count = await db
		.select()
		.from(cyclistsCounts)
		.where(eq(cyclistsCounts.id, id));

	if (count.length === 0) {
		return c.json({ message: "Cyclists count not found" }, 404);
	}

	return c.json(count[0]);
};
