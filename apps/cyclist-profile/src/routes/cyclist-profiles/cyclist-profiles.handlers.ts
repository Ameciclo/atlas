import type { RouteHandler } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";
import type { GetOneRoute, ListRoute } from "./cyclist-profiles.routes.ts";

import { db } from "../../db/index.ts";

export const list: RouteHandler<ListRoute> = async (c) => {
	const cyclistProfiles = await db.query.cyclistProfiles.findMany();
	return c.json(cyclistProfiles);
};

export const getOne: RouteHandler<GetOneRoute> = async (c) => {
	const { id } = c.req.valid("param");
	const task = await db.query.cyclistProfiles.findFirst({
		where(fields, operators) {
			return operators.eq(fields.id, id);
		},
	});

	if (!task) {
		return c.json(
			{
				message: HttpStatusPhrases.NOT_FOUND,
			},
			HttpStatusCodes.NOT_FOUND,
		);
	}

	return c.json(task, HttpStatusCodes.OK);
};
