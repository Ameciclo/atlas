import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const tags = ["Categories"];

const categoriesQuerySchema = z.object({
	group: z.string().optional(),
});

const categoryItemSchema = z.object({
	code: z.string(),
	label: z.string(),
	count: z.number().optional(),
});

export const list = createRoute({
	path: "/categories",
	method: "get",
	request: {
		query: categoriesQuerySchema,
	},
	tags,
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({ data: z.array(categoryItemSchema) }),
			"Available category values",
		),
	},
});

export type ListRoute = typeof list;
