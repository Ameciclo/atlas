import { createRoute, z } from "@hono/zod-openapi";

const nearbyInputSchema = z
	.object({
		lat: z
			.string()
			.transform(Number)
			.pipe(z.number().min(-90).max(90))
			.optional()
			.openapi({ example: "-8.0476" }),
		lng: z
			.string()
			.transform(Number)
			.pipe(z.number().min(-180).max(180))
			.optional()
			.openapi({ example: "-34.8770" }),
		street: z
			.string()
			.optional()
			.openapi({
				example: "9803",
				description: "pcr_streets ID — searches along street geometry instead of a GPS point",
			}),
	radius: z
		.string()
		.transform(Number)
		.pipe(z.number().min(1).max(5000))
		.optional()
		.openapi({ example: "10" }),
	ticket_limit: z
		.string()
		.transform(Number)
		.pipe(z.number().min(1).max(20))
		.default("5")
		.openapi({ example: "5" }),
	})
	.refine(
		(data) =>
			(data.lat !== undefined && data.lng !== undefined) ||
			data.street !== undefined,
		{
			message: "Either (lat AND lng) OR street must be provided",
		},
	);

const nearbyResponseSchema = z.object({
	location: z.object({
		lat: z.number(),
		lng: z.number(),
		nearest_street: z
			.object({
				id: z.number(),
				name: z.string(),
				official_name: z.string(),
				clogra_codi: z.number(),
				total_length_meters: z.number(),
				distance_to_point_meters: z.number(),
			})
			.nullable(),
		nearby_streets: z.array(
			z.object({
				id: z.number(),
				clogra_codi: z.number(),
				name: z.string(),
				official_name: z.string(),
				distance_meters: z.number(),
			}),
		),
	}),
	emergency_calls: z.object({
		annual_history: z.array(
			z.object({
				year: z.number(),
				total_calls: z.number(),
			}),
		),
		last_month_data: z
			.object({
				month: z.string(),
				total_calls: z.number(),
			})
			.nullable(),
		first_month_data: z
			.object({
				month: z.string(),
				total_calls: z.number(),
			})
			.nullable(),
		by_category: z.array(
			z.object({
				category: z.string(),
				count: z.number(),
			}),
		),
		by_gender: z.array(
			z.object({
				gender: z.string().nullable(),
				count: z.number(),
			}),
		),
		by_age_group: z.array(
			z.object({
				age_group: z.string(),
				count: z.number(),
			}),
		),
	}),
	bike_racks: z.object({
		total: z.number(),
		total_capacity: z.number(),
		items: z.array(
			z.object({
				id: z.number(),
				name: z.string().nullable(),
				capacity: z.string().nullable(),
				type: z.string().nullable(),
				lat: z.number(),
				lng: z.number(),
				distance_meters: z.number(),
			}),
		),
	}),
	cyclist_counts: z.object({
		counts: z.array(
			z.object({
				id: z.number(),
				name: z.string(),
				date: z.string(),
				city: z.string(),
				total_cyclists: z.number(),
				distance_meters: z.number(),
				characteristics: z.object({
					cargo: z.number(),
					helmet: z.number(),
					juveniles: z.number(),
					motor: z.number(),
					ride: z.number(),
					service: z.number(),
					shared_bike: z.number(),
					sidewalk: z.number(),
					women: z.number(),
					wrong_way: z.number(),
				}),
			}),
		),
	}),
	shared_bike: z.object({
		has_stations: z.boolean(),
		stations: z.array(
			z.object({
				id: z.number(),
				name: z.string(),
				capacity: z.number(),
				distance_meters: z.number(),
			}),
		),
	}),
	cycling_infra: z.object({
		existing: z.array(
			z.object({
				type: z.string(),
				name: z.string().nullable(),
				distance_meters: z.number(),
			}),
		),
		planned_pdc: z.array(
			z.object({
				id: z.number(),
				pdc_ref: z.string(),
				typology: z.string(),
				name: z.string().nullable(),
				pdc_stretch: z.string().nullable(),
				pdc_cities: z.string().nullable(),
				pdc_km: z.number().nullable(),
			}),
		),
	}),
	cyclist_profile: z.object({
		total_profiles: z.number(),
		by_edition: z.array(
			z.object({
				edition: z.string(),
				total_profiles: z.number(),
				race_distribution: z.record(z.string(), z.number()),
				gender_distribution: z.record(z.string(), z.number()),
				age_distribution: z.record(z.string(), z.number()),
				education_distribution: z.record(z.string(), z.number()),
				income_distribution: z.record(z.string(), z.number()),
				other_attributes: z.record(z.string(), z.number()),
			}),
		),
	}),
	traffic_tickets: z.object({
		total_violations: z.number(),
		last_month_data: z
			.object({
				month: z.string(),
				total: z.number(),
			})
			.nullable(),
		first_month_data: z
			.object({
				month: z.string(),
				total: z.number(),
			})
			.nullable(),
		by_year: z.array(
			z.object({
				year: z.number(),
				total: z.number(),
			}),
		),
		top_violations: z.array(
			z.object({
				law_code: z.string(),
				description: z.string(),
				count: z.number(),
				percentage: z.number(),
			}),
		),
		vulnerable_violations: z.array(
			z.object({
				law_code: z.string(),
				description: z.string(),
				count: z.number(),
			}),
		),
	}),
});

export const nearbyRoute = createRoute({
	method: "get",
	path: "/nearby",
	request: {
		query: nearbyInputSchema,
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: nearbyResponseSchema,
				},
			},
			description: "Dados próximos ao ponto GPS fornecido",
		},
	},
	tags: ["Nearby"],
});
