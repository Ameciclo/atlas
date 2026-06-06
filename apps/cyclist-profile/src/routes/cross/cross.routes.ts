import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const tags = ["Cross"];

const filtersSchema = z.object({
	year: z.array(z.number()).optional(),
	gender: z.array(z.string()).optional(),
	race_color: z.array(z.string()).optional(),
	age_min: z.number().optional(),
	age_max: z.number().optional(),
	age_group: z.array(z.string()).optional(),
	schooling: z.array(z.string()).optional(),
	income_range: z.array(z.string()).optional(),
	bike_type: z.array(z.string()).optional(),
	collided: z.boolean().optional(),
	days_total_min: z.number().optional(),
	days_total_max: z.number().optional(),
	days_working_min: z.number().optional(),
	days_working_max: z.number().optional(),
	years_using: z.array(z.string()).optional(),
	distance_time_min: z.number().optional(),
	distance_time_max: z.number().optional(),
	biggest_issue: z.array(z.string()).optional(),
	biggest_need: z.array(z.string()).optional(),
	motivation_to_start: z.array(z.string()).optional(),
	motivation_to_continue: z.array(z.string()).optional(),
	living_place: z.array(z.string()).optional(),
	origin_place: z.array(z.string()).optional(),
	destination_place: z.array(z.string()).optional(),
	combines_transport: z.boolean().optional(),
	transport_mode: z.array(z.string()).optional(),
	weekday: z.array(z.string()).optional(),
	area: z.array(z.string()).optional(),
	point_neighborhood: z.array(z.string()).optional(),
});

const sortSchema = z.object({
	field: z.string(),
	direction: z.enum(["asc", "desc"]),
});

const optionsSchema = z.object({
	include_total: z.boolean().optional().default(false),
	include_unknown: z.boolean().optional().default(false),
	min_n: z.number().optional().default(5),
	sort: sortSchema.optional(),
	limit: z.number().optional(),
});

const crossRequestSchema = z.object({
	filters: filtersSchema.optional().default({}),
	group_by: z.array(z.string()).max(3).optional().default([]),
	compare_by: z.array(z.string()).max(2).optional().default([]),
	metrics: z.array(z.string()).optional().default(["count", "percent"]),
	options: optionsSchema.optional().default({}),
});

export const query = createRoute({
	path: "/cross",
	method: "post",
	request: {
		body: jsonContent(crossRequestSchema, "Cross-tabulation query"),
	},
	tags,
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.unknown(),
			"Cross-tabulation results",
		),
	},
});

export type QueryRoute = typeof query;
