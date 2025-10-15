import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { IdParamsSchema } from "stoker/openapi/schemas";

import { selectTrafficDeath } from "../../db/schema.js";
import { notFoundSchema } from "../../lib/constants.js";

const tags = ["Traffic Deaths"];

export const list = createRoute({
	path: "/traffic-deaths",
	method: "get",
	tags,
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.array(selectTrafficDeath),
			"The list of traffic deaths from DATASUS",
		),
	},
});

export const getOne = createRoute({
	path: "/traffic-deaths/{id}",
	method: "get",
	request: {
		params: IdParamsSchema,
	},
	tags,
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			selectTrafficDeath,
			"The requested traffic death record",
		),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(
			notFoundSchema,
			"Traffic death record not found",
		),
	},
});

export type ListRoute = typeof list;
export type GetOneRoute = typeof getOne;
