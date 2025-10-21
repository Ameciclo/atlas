import type { RouteHandler } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";
import { db } from "../../db/index.js";
import type { AppBindings } from "../../lib/types.ts";
import type { GetOneRoute, ListRoute } from "./cyclist-profiles.routes.ts";

export const list: RouteHandler<ListRoute, AppBindings> = async (c) => {
	const cyclistProfiles = await db.query.cyclistProfiles.findMany();
	return c.json(cyclistProfiles);
};

export const getOne: RouteHandler<GetOneRoute, AppBindings> = async (c) => {
	const { id } = c.req.valid("param");
	const cyclistProfile = await db.query.cyclistProfiles.findFirst({
		where(fields, operators) {
			return operators.eq(fields.id, id);
		},
	});

	if (!cyclistProfile) {
		return c.json(
			{
				message: HttpStatusPhrases.NOT_FOUND,
			},
			HttpStatusCodes.NOT_FOUND,
		);
	}

	return c.json(cyclistProfile, HttpStatusCodes.OK);
};
