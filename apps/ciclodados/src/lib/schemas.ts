import { z } from "zod";

// Street search schemas
export const streetSearchQuerySchema = z.object({
	q: z.string().min(1, "Search query is required"),
	limit: z.coerce.number().min(1).max(100).default(10),
	by_length: z.coerce.boolean().optional(),
	by_elements: z.coerce.boolean().optional(),
});

export const streetSearchResponseSchema = z.object({
	matches: z.array(z.object({
		id: z.string(),
		name: z.string(),
		confidence: z.number().min(0).max(1),
		municipality: z.string().optional(),
		length: z.number().optional(),
		elements: z.number().optional(),
	})),
});

// Street details schemas
export const streetDetailsParamsSchema = z.object({
	streetId: z.string(),
});

export const streetDetailsResponseSchema = z.object({
	id: z.string(),
	name: z.string(),
	geometry: z.object({
		type: z.literal("LineString"),
		coordinates: z.array(z.array(z.number())),
	}),
	properties: z.record(z.unknown()),
});

// Nearby data schemas
export const nearbyQuerySchema = z.object({
	buffer: z.coerce.number().min(10).max(500).default(50),
});

export const nearbyDataResponseSchema = z.object({
	cycling_counts: z.array(z.unknown()),
	cycling_profile: z.array(z.unknown()),
	cycle_infra: z.array(z.unknown()),
	shared_bicycles: z.array(z.unknown()),
	bike_racks: z.array(z.unknown()),
});

// Point analysis schemas
export const pointAnalysisBodySchema = z.object({
	lat: z.number().min(-90).max(90),
	lng: z.number().min(-180).max(180),
	buffer: z.coerce.number().min(10).max(500).default(100),
});

export const pointAnalysisResponseSchema = z.object({
	nearby_streets: z.array(z.unknown()),
	traffic_data: z.object({
		violations: z.array(z.unknown()),
		crashes: z.array(z.unknown()),
	}),
	cycling_data: nearbyDataResponseSchema,
});

// Traffic data schemas
export const trafficDataResponseSchema = z.object({
	violations: z.array(z.unknown()),
	crashes: z.array(z.unknown()),
});

// Error schemas
export const errorResponseSchema = z.object({
	error: z.string(),
	message: z.string(),
	details: z.unknown().optional(),
});