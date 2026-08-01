import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const tags = ["Filters"];

const filterOptionSchema = z.object({
	code: z.string(),
	label: z.string(),
});

const countPointSchema = z.object({
	code: z.string(),
	label: z.string(),
	lat: z.number().nullable(),
	lon: z.number().nullable(),
	years: z.array(z.number()),
	count: z.number(),
});

const filtersResponseSchema = z.object({
	data: z.object({
		years: z.array(z.number()),
		areas: z.array(filterOptionSchema),
		genders: z.array(filterOptionSchema),
		race_colors: z.array(filterOptionSchema),
		age_categories: z.array(filterOptionSchema),
		schooling_levels: z.array(filterOptionSchema),
		income_ranges: z.array(filterOptionSchema),
		bike_types: z.array(filterOptionSchema),
		years_using_options: z.array(filterOptionSchema),
		issues: z.array(filterOptionSchema),
		needs: z.array(filterOptionSchema),
		motivations_start: z.array(filterOptionSchema),
		motivations_continue: z.array(filterOptionSchema),
		transport_modes: z.array(filterOptionSchema),
		weekdays: z.array(filterOptionSchema),
		count_points: z.array(countPointSchema),
		total_interviews: z.number(),
	}),
});

export const list = createRoute({
	path: "/filters",
	method: "get",
	tags,
	request: {
		query: z.object({
			min_interviews: z.coerce.number().int().optional().default(30).openapi({
				description:
					"Minimum number of interviews per count point (default: 30)",
				example: 30,
			}),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			filtersResponseSchema,
			"Available filter options for the UI",
		),
	},
});

export type ListRoute = typeof list;
