import { createRoute, z } from "@hono/zod-openapi";

const summaryResponseSchema = z.object({
	total_violations: z.number(),
	data_period: z.object({
		start: z.string(),
		end: z.string(),
	}),
	violations_per_year: z.record(z.number()),
	top_violation_type: z.object({
		id: z.number(),
		description: z.string(),
		total: z.number(),
	}),
	most_active_agent: z.object({
		id: z.number(),
		total_violations: z.number(),
	}),
});

const byTypeResponseSchema = z.object({
	violation_types: z.array(
		z.object({
			description: z.string(),
			total_violations: z.number(),
			percentage: z.number(),
			violations_per_year: z.record(z.number()),
		}),
	),
});

export const summary = createRoute({
	method: "get",
	path: "/violations/summary",
	tags: ["Traffic Violations"],
	summary: "Get violations summary",
	description: "Get general summary of traffic violations",
	responses: {
		200: {
			content: {
				"application/json": {
					schema: summaryResponseSchema,
				},
			},
			description: "Traffic violations summary",
		},
	},
});

export const byType = createRoute({
	method: "get",
	path: "/violations/by-type",
	tags: ["Traffic Violations"],
	summary: "Get violations by type",
	description: "Get traffic violations grouped by type",
	request: {
		query: z.object({
			start_date: z.string().date().optional(),
			end_date: z.string().date().optional(),
			limit: z.coerce.number().int().min(1).max(100).default(10).optional(),
		}),
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: byTypeResponseSchema,
				},
			},
			description: "Violations by type",
		},
	},
});

export const byAgent = createRoute({
	method: "get",
	path: "/violations/by-agent",
	tags: ["Traffic Violations"],
	summary: "Get violations by agent",
	description: "Get traffic violations grouped by agent",
	request: {
		query: z.object({
			start_date: z.string().date().optional(),
			end_date: z.string().date().optional(),
			limit: z.coerce.number().int().min(1).max(100).default(10).optional(),
		}),
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						agents: z.array(
							z.object({
								agent_id: z.number(),
								total_violations: z.number(),
								ranking: z.number(),
								violations_per_month: z.record(z.number()),
							}),
						),
					}),
				},
			},
			description: "Violations by agent",
		},
	},
});

export const temporalAnalysis = createRoute({
	method: "get",
	path: "/violations/temporal-analysis",
	tags: ["Traffic Violations"],
	summary: "Get temporal analysis",
	description: "Get temporal analysis of violations",
	request: {
		query: z.object({
			start_date: z.string().date().optional(),
			end_date: z.string().date().optional(),
		}),
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						period: z.object({
							start: z.string(),
							end: z.string(),
						}),
						by_month: z.record(z.number()),
						by_weekday: z.record(z.number()),
						by_hour: z.record(z.number()),
					}),
				},
			},
			description: "Temporal analysis data",
		},
	},
});
