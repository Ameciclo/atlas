import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const tags = ["Emergency Calls"];

export const summary = createRoute({
	path: "/calls/summary",
	method: "get",
	tags,
	summary: "Get emergency calls summary",
	description: "Get general summary of emergency calls data",
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				total_calls: z.number(),
				data_period: z.object({
					start: z.string(),
					end: z.string(),
				}),
				calls_per_year: z.record(z.number()),
				municipalities_count: z.number(),
				top_city: z.object({
					name: z.string(),
					total_calls: z.number(),
				}),
			}),
			"Emergency calls summary",
		),
	},
});

export const cities = createRoute({
	path: "/calls/cities",
	method: "get",
	tags,
	summary: "Get cities ranking",
	description: "Get complete ranking of cities by emergency calls",
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				cities: z.array(
					z.object({
						ranking: z.number(),
						municipality: z.string(),
						total_calls: z.number(),
						percentage: z.number(),
					}),
				),
			}),
			"Cities ranking by emergency calls",
		),
	},
});

export const cityStats = createRoute({
	path: "/calls/cities/{city}/stats",
	method: "get",
	tags,
	summary: "Get city statistics",
	description: "Get statistics for a specific city",
	request: {
		params: z.object({
			city: z.string().openapi({
				description: "City name",
				example: "RECIFE",
			}),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				city: z.string(),
				ranking: z.number(),
				yearly_history: z.record(z.number()),
			}),
			"City emergency calls statistics",
		),
	},
});

export const outcomes = createRoute({
	path: "/calls/outcomes",
	method: "get",
	tags,
	summary: "Get call outcomes",
	description: "Get emergency call outcomes by city and year",
	request: {
		query: z.object({
			city: z.string().openapi({
				description: "City name (required)",
				example: "RECIFE",
			}),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				city: z.string(),
				outcomes_by_year: z.record(
					z.record(z.number()),
				),
			}),
			"Emergency call outcomes by year",
		),
	},
});

export const profiles = createRoute({
	path: "/calls/profiles",
	method: "get",
	tags,
	summary: "Get call profiles",
	description: "Get demographic profiles of emergency calls",
	request: {
		query: z.object({
			city: z.string().openapi({
				description: "City name (required)",
				example: "RECIFE",
			}),
			start_year: z.coerce.number().int().optional().openapi({
				description: "Start year",
				example: 2020,
			}),
			end_year: z.coerce.number().int().optional().openapi({
				description: "End year",
				example: 2022,
			}),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				city: z.string(),
				period: z.object({
					start_year: z.number(),
					end_year: z.number(),
				}),
				by_gender: z.record(z.number()),
				by_age_group: z.record(z.number()),
				by_transport_mode: z.record(z.number()),
			}),
			"Emergency call demographic profiles",
		),
	},
});

export type SummaryRoute = typeof summary;
export type CitiesRoute = typeof cities;
export type CityStatsRoute = typeof cityStats;
export type OutcomesRoute = typeof outcomes;
export type ProfilesRoute = typeof profiles;