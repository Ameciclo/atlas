import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const tags = ["Points"];

const querySchema = z.object({
	year: z.coerce.number().optional(),
	area: z.string().optional(),
	gender: z.string().optional(),
	race: z.string().optional(),
	income: z.string().optional(),
	min_interviews: z.coerce.number().int().optional().default(30).openapi({
		description: "Minimum number of interviews per point (default: 30)",
		example: 30,
	}),
});

export const list = createRoute({
	path: "/points",
	method: "get",
	request: { query: querySchema },
	tags,
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.unknown(),
			"Survey points with aggregated data",
		),
	},
});

export const geojson = createRoute({
	path: "/points.geojson",
	method: "get",
	request: { query: querySchema },
	tags,
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.unknown(),
			"Survey points in GeoJSON format",
		),
	},
});

export type ListRoute = typeof list;
export type GeoJsonRoute = typeof geojson;
