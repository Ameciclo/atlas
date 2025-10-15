import { eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";

import type { AppRouteHandler } from "../../lib/types.js";
import type * as routes from "./example.routes.js";
import { db } from "../../db/index.js";
import { traffic_deaths } from "../../db/schema.js";

export const list: AppRouteHandler<routes.ListRoute> = async (c) => {
	const deaths = await db.select().from(traffic_deaths).limit(100);
	return c.json(deaths);
};

export const getOne: AppRouteHandler<routes.GetOneRoute> = async (c) => {
	const { id } = c.req.valid("param");
	const death = await db.select().from(traffic_deaths).where(eq(traffic_deaths.id, id)).limit(1);
	
	if (death.length === 0) {
		return c.json({ message: "Traffic death record not found" }, HttpStatusCodes.NOT_FOUND);
	}
	
	return c.json(death[0]);
};
