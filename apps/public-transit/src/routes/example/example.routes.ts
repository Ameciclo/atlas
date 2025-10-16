import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const tags = ["Example"];

const exampleSchema = z.object({
	id: z.number(),
	message: z.string(),
	timestamp: z.string(),
});

export const list = createRoute({
	path: "/examples",
	method: "get",
	tags,
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.array(exampleSchema),
			"List of examples",
		),
	},
});

export type ListRoute = typeof list;
