import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const tags = ["Downloads"];

const downloadRequestSchema = z.object({
	filters: z.object({
		year: z.array(z.number()).optional(),
		gender: z.array(z.string()).optional(),
		race_color: z.array(z.string()).optional(),
		income_range: z.array(z.string()).optional(),
		biggest_issue: z.array(z.string()).optional(),
	}).optional().default({}),
	group_by: z.array(z.string()).optional().default([]),
	compare_by: z.array(z.string()).optional().default([]),
	metrics: z.array(z.string()).optional().default(["count"]),
});

export const aggregateCsv = createRoute({
	path: "/downloads/aggregate.csv",
	method: "post",
	request: {
		body: jsonContent(downloadRequestSchema, "Download query parameters"),
	},
	tags,
	responses: {
		[HttpStatusCodes.OK]: {
			description: "CSV download",
			content: { "text/csv": { schema: { type: "string" } } },
		},
	},
});

export type AggregateCsvRoute = typeof aggregateCsv;
