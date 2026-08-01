import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const tags = ["Dictionary"];

const fieldSchema = z.object({
	field: z.string(),
	label: z.string(),
	type: z.enum(["category", "numeric", "boolean", "text"]),
	description: z.string(),
	source: z.string(),
	group: z.string(),
});

const dictionaryResponseSchema = z.object({
	data: z.object({
		fields: z.array(fieldSchema),
	}),
});

export const list = createRoute({
	path: "/dictionary",
	method: "get",
	tags,
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			dictionaryResponseSchema,
			"Data dictionary for cyclist profile fields",
		),
	},
});

export type ListRoute = typeof list;
