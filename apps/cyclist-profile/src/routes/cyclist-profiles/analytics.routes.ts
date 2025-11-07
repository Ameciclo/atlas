import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createErrorSchema } from "stoker/openapi/schemas";

const tags = ["Cyclist Analytics"];

const YearQuerySchema = z.object({
	year: z.coerce.number().optional(),
});

const YearsQuerySchema = z.object({
	years: z.string().optional().default("2015,2018,2021,2024"),
});

export const summary = createRoute({
	path: "/cyclist-profiles/summary",
	method: "get",
	request: {
		query: YearQuerySchema,
	},
	tags,
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.unknown(),
			"Cyclist profile summary statistics",
		),
		[HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
			createErrorSchema(YearQuerySchema),
			"Invalid parameters",
		),
	},
});

export const trends = createRoute({
	path: "/cyclist-profiles/trends",
	method: "get",
	request: {
		query: YearsQuerySchema,
	},
	tags,
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.unknown(),
			"Cyclist profile trends across years",
		),
	},
});

export const genderAnalysis = createRoute({
	path: "/cyclist-profiles/gender-analysis",
	method: "get",
	request: {
		query: YearQuerySchema,
	},
	tags,
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.unknown(),
			"Gender-based cyclist analysis",
		),
	},
});

export const safetyAnalysis = createRoute({
	path: "/cyclist-profiles/safety-analysis",
	method: "get",
	request: {
		query: YearQuerySchema,
	},
	tags,
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.unknown(),
			"Safety analysis for cyclists",
		),
	},
});

const LocationQuerySchema = z.object({
	year: z.coerce.number().optional(),
	gender: z.string().optional(),
	race: z.string().optional(),
	income: z.string().optional(),
});

export const surveyLocations = createRoute({
	path: "/cyclist-profiles/survey-locations",
	method: "get",
	request: {
		query: LocationQuerySchema,
	},
	tags,
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.unknown(),
			"Survey locations with aggregated data",
		),
	},
});

export type SummaryRoute = typeof summary;
export type TrendsRoute = typeof trends;
export type GenderAnalysisRoute = typeof genderAnalysis;
export type SafetyAnalysisRoute = typeof safetyAnalysis;
export type SurveyLocationsRoute = typeof surveyLocations;