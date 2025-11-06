import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const tags = ["Infrastructure Summary"];

const summaryResponseSchema = z.object({
	existing_infrastructure_km: z.number(),
	planned_infrastructure_km: z.number(),
	implemented_from_plan_km: z.number(),
	plan_coverage_percentage: z.number(),
	by_type: z.record(
		z.object({
			existing: z.number(),
			planned: z.number(),
			implemented: z.number(),
		})
	),
	last_updated: z.string(),
});

const geoJsonResponseSchema = z.object({
	type: z.literal("FeatureCollection"),
	features: z.array(z.any()),
	summary: summaryResponseSchema,
});

export const summary = createRoute({
	path: "/v1/infrastructure/summary",
	method: "get",
	tags,
	summary: "Get infrastructure summary",
	description: "Get executive summary of cycling infrastructure",
	request: {
		query: z.object({
			city: z.string().optional().openapi({
				description: "Filter by city",
				example: "Recife",
			}),
			type: z.string().optional().openapi({
				description: "Filter by infrastructure type",
				example: "Ciclovia",
			}),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			summaryResponseSchema,
			"Infrastructure summary",
		),
	},
});

export const cycleways = createRoute({
	path: "/v1/infrastructure/cycleways",
	method: "get",
	tags,
	summary: "Get cycleways GeoJSON with metrics",
	description: "Get GeoJSON of cycleways with integrated metrics",
	request: {
		query: z.object({
			city: z.string().optional().openapi({
				description: "Filter by city",
				example: "Recife",
			}),
			type: z.string().optional().openapi({
				description: "Filter by infrastructure type",
				example: "Ciclovia",
			}),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			geoJsonResponseSchema,
			"Cycleways GeoJSON with metrics",
		),
	},
});

export const cityCoverage = createRoute({
	path: "/v1/infrastructure/city-coverage",
	method: "get",
	tags,
	summary: "Get coverage by city",
	description: "Get infrastructure coverage for all cities",
	request: {
		query: z.object({
			state: z.string().optional().openapi({
				description: "Filter by state",
				example: "PE",
			}),
			region: z.string().optional().openapi({
				description: "Filter by region",
				example: "Nordeste",
			}),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				cities: z.array(
					z.object({
						city_id: z.number(),
						city_name: z.string(),
						existing_infrastructure_km: z.number(),
						planned_infrastructure_km: z.number(),
						implemented_from_plan_km: z.number(),
						plan_coverage_percentage: z.number(),
						by_type: z.record(
							z.object({
								existing: z.number(),
								planned: z.number(),
								implemented: z.number(),
							})
						),
						last_updated: z.string(),
					})
				),
			}),
			"City coverage data",
		),
	},
});

export const citySpecificSummary = createRoute({
	path: "/v1/infrastructure/cities/{city_id}/summary",
	method: "get",
	tags,
	summary: "Get city specific summary",
	description: "Get summary for a specific city with PDC Recife data",
	request: {
		params: z.object({
			city_id: z.coerce.number().int().positive().openapi({
				description: "City ID",
				example: 1,
			}),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			summaryResponseSchema.extend({
				pdc_recife: z.object({
					routes: z.array(
						z.object({
							route_name: z.string(),
							planned_typology: z.string(),
							planned_extension_km: z.number(),
							executed_typology: z.string(),
							executed_extension_km: z.number(),
						})
					),
				}).optional(),
			}),
			"City specific summary with PDC data",
		),
	},
});