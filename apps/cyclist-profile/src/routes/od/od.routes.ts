import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const tags = ["OriginDestination"];

const odRequestSchema = z.object({
	filters: z
		.object({
			year: z.array(z.number()).optional(),
			gender: z.array(z.string()).optional(),
			income_range: z.array(z.string()).optional(),
			race_color: z.array(z.string()).optional(),
		})
		.optional()
		.default({}),
	metric: z.enum(["interviews_count", "distance_time_median"]).optional().default("interviews_count"),
	min_count: z.number().optional().default(3),
	limit: z.number().optional().default(50),
});

export const matrix = createRoute({
	path: "/od/matrix",
	method: "post",
	request: { body: jsonContent(odRequestSchema, "OD matrix query") },
	tags,
	responses: {
		[HttpStatusCodes.OK]: jsonContent(z.unknown(), "OD matrix"),
	},
});

export const flows = createRoute({
	path: "/od/flows.geojson",
	method: "post",
	request: { body: jsonContent(odRequestSchema, "OD flows query") },
	tags,
	responses: {
		[HttpStatusCodes.OK]: jsonContent(z.unknown(), "OD flows in GeoJSON"),
	},
});

export type MatrixRoute = typeof matrix;
export type FlowsRoute = typeof flows;
