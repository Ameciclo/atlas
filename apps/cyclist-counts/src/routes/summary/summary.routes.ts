import { createRoute, z } from "@hono/zod-openapi";

const tags = ["Summary"];

const CountEditionCoordinatesSchema = z.object({
	x: z.number(),
	y: z.number(),
	type: z.string(),
	name: z.string(),
});

const CitySchema = z.object({
	id: z.number(),
	name: z.string(),
	state: z.string(),
});

const MaxCountedDetailsSchema = z.object({
	slug: z.string(),
	coordinates: CountEditionCoordinatesSchema.optional(),
	total_cyclists: z.number(),
	date: z.string(),
});

const CountEditionSchema = z.object({
	id: z.number(),
	slug: z.string(),
	name: z.string(),
	date: z.string(),
	coordinates: CountEditionCoordinatesSchema.optional(),
	city: CitySchema,
	total_cyclists: z.number(),
});

const CountEditionSummarySchema = z.object({
	total_cyclists: z.number(),
	number_counts: z.number(),
	different_counts_points: z.number(),
	where_max_count: MaxCountedDetailsSchema,
	total_cargo: z.number(),
	total_helmet: z.number(),
	total_juveniles: z.number(),
	total_motor: z.number(),
	total_ride: z.number(),
	total_service: z.number(),
	total_shared_bike: z.number(),
	total_sidewalk: z.number(),
	total_women: z.number(),
	total_wrong_way: z.number(),
});

const SummaryResponseSchema = z.object({
	counts: z.array(CountEditionSchema),
	summary: CountEditionSummarySchema,
});

export const getSummary = createRoute({
	method: "get",
	path: "/summary",
	tags,
	summary: "Get cyclist counts summary",
	description: "Get a comprehensive summary of all cyclist counting data including totals and characteristics",
	responses: {
		200: {
			content: {
				"application/json": {
					schema: SummaryResponseSchema,
				},
			},
			description: "Summary of cyclist counting data",
		},
		500: {
			content: {
				"application/json": {
					schema: z.object({ error: z.string() }),
				},
			},
			description: "Internal server error",
		},
	},
});