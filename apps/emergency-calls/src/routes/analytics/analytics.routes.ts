import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const tags = ["Analytics"];

// Response schemas
const municipalityStatsSchema = z.object({
	municipality: z.string(),
	call_count: z.number(),
});

const accidentTypeSchema = z.object({
	subtype: z.string(),
	count: z.number(),
});

const genderDistributionSchema = z.object({
	gender: z.string().nullable(),
	count: z.number(),
	percentage: z.number(),
});

const dangerousStreetSchema = z.object({
	street: z.string(),
	total_accidents: z.number(),
	fatal_cases: z.number(),
	fatality_rate: z.number(),
});

export const municipalityStats = createRoute({
	path: "/analytics/municipalities",
	method: "get",
	tags,
	summary: "Municipality statistics",
	description: "Get emergency call statistics by municipality",
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.array(municipalityStatsSchema),
			"Municipality statistics",
		),
	},
});

export const accidentTypes = createRoute({
	path: "/analytics/accident-types",
	method: "get",
	tags,
	summary: "Accident type statistics",
	description: "Get statistics by accident type",
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.array(accidentTypeSchema),
			"Accident type statistics",
		),
	},
});

export const genderDistribution = createRoute({
	path: "/analytics/gender-distribution",
	method: "get",
	tags,
	summary: "Gender distribution",
	description: "Get gender distribution of emergency calls",
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.array(genderDistributionSchema),
			"Gender distribution",
		),
	},
});

export const dangerousStreets = createRoute({
	path: "/analytics/dangerous-streets",
	method: "get",
	tags,
	summary: "Most dangerous streets in Recife",
	description:
		"Get the most dangerous streets by accident count and fatality rate",
	request: {
		query: z.object({
			sort_by: z
				.enum(["accidents", "fatality_rate"])
				.default("accidents")
				.openapi({
					description: "Sort by total accidents or fatality rate",
					example: "accidents",
				}),
			limit: z.coerce.number().int().positive().max(50).default(20).openapi({
				description: "Maximum number of results",
				example: 20,
			}),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.array(dangerousStreetSchema),
			"Most dangerous streets",
		),
	},
});

export type MunicipalityStatsRoute = typeof municipalityStats;
export type AccidentTypesRoute = typeof accidentTypes;
export type GenderDistributionRoute = typeof genderDistribution;
export type DangerousStreetsRoute = typeof dangerousStreets;
