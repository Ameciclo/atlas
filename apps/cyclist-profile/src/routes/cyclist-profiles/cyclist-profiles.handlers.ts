import type { RouteHandler } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";
import { db } from "../../db/index.js";
import { cyclistProfiles } from "@atlas/database/schemas/cyclist-profile";
import type { AppBindings } from "../../lib/types.ts";
import type { GetOneRoute, ListRoute } from "./cyclist-profiles.routes.ts";

export const list: RouteHandler<ListRoute, AppBindings> = async (c) => {
	const profiles = await db.select().from(cyclistProfiles);
	return c.json(profiles);
};

export const getOne: RouteHandler<GetOneRoute, AppBindings> = async (c) => {
	const { id } = c.req.valid("param");
	const profile = await db
		.select()
		.from(cyclistProfiles)
		.where(eq(cyclistProfiles.id, id))
		.limit(1);

	if (profile.length === 0) {
		return c.json(
			{
				message: HttpStatusPhrases.NOT_FOUND,
			},
			HttpStatusCodes.NOT_FOUND,
		);
	}

	return c.json(profile[0], HttpStatusCodes.OK);
};
