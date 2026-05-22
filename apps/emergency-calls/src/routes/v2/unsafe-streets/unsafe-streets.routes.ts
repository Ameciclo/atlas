import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const tags = ["Unsafe Streets"];

export const citySummary = createRoute({
	path: "/unsafe-streets/cities/{city}/summary",
	method: "get",
	tags,
	summary: "Get city accidents summary",
	description: "Get summary of accidents by city",
	request: {
		params: z.object({
			city: z.string().openapi({
				description: "City name",
				example: "RECIFE",
			}),
		}),
		query: z.object({
			start_year: z.coerce.number().optional().openapi({
				description: "Start year",
				example: 2020,
			}),
			end_year: z.coerce.number().optional().openapi({
				description: "End year",
				example: 2022,
			}),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				city: z.string(),
				total_accidents: z.number(),
				accidents_per_year: z.record(z.number()),
				total_streets: z.number(),
				extensaoTotalKm: z.number().optional(),
				period: z.object({
					start_year: z.number(),
					end_year: z.number(),
				}),
				most_dangerous_street: z.object({
					name: z.string(),
					total_accidents: z.number(),
				}),
			}),
			"City accidents summary",
		),
	},
});

export const streetSummary = createRoute({
	path: "/unsafe-streets/streets/{street_name}/summary",
	method: "get",
	tags,
	summary: "Get street summary",
	description: "Get summary for a specific street",
	request: {
		params: z.object({
			street_name: z.string().openapi({
				description: "Street name",
				example: "Av. Boa Viagem",
			}),
		}),
		query: z.object({
			city: z.string().optional().openapi({
				description: "City name for filtering",
				example: "RECIFE",
			}),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				street_name: z.string(),
				total_victims: z.number(),
				victims_per_year: z.record(z.number()),
				street_extension_km: z.number().optional(),
			}),
			"Street accidents summary",
		),
	},
});

export const cityConcentration = createRoute({
	path: "/unsafe-streets/cities/{city}/concentration",
	method: "get",
	tags,
	summary: "Get accident concentration data",
	description: "Get concentration of accidents by intervals",
	request: {
		params: z.object({
			city: z.string().openapi({
				description: "City name",
				example: "RECIFE",
			}),
		}),
		query: z.object({
			interval: z.coerce.number().optional().openapi({
				description: "Interval for concentration (1, 5, 10, 15, 20)",
				example: 10,
			}),
			start_year: z.coerce.number().optional().openapi({
				description: "Start year",
				example: 2020,
			}),
			end_year: z.coerce.number().optional().openapi({
				description: "End year",
				example: 2022,
			}),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				city: z.string(),
				interval: z.number(),
				concentration_data: z.array(
					z.object({
						ranking: z.number(),
						total_accidents: z.number(),
						street_extension_km: z.number().optional(),
					}),
				),
			}),
			"Accident concentration data",
		),
	},
});

export const cityGeoJSON = createRoute({
	path: "/unsafe-streets/cities/{city}/geojson",
	method: "get",
	tags,
	summary: "Get city streets GeoJSON",
	description: "Get geospatial data of dangerous streets",
	request: {
		params: z.object({
			city: z.string().openapi({
				description: "City name",
				example: "RECIFE",
			}),
		}),
		query: z.object({
			ranking_from: z.coerce.number().optional().openapi({
				description: "Starting ranking position",
				example: 1,
			}),
			ranking_to: z.coerce.number().optional().openapi({
				description: "Ending ranking position",
				example: 10,
			}),
			start_year: z.coerce.number().optional().openapi({
				description: "Start year",
				example: 2020,
			}),
			end_year: z.coerce.number().optional().openapi({
				description: "End year",
				example: 2022,
			}),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				type: z.literal("FeatureCollection"),
				features: z.array(
					z.object({
						type: z.literal("Feature"),
						geometry: z.object({
							type: z.string(),
							coordinates: z.any(),
						}),
						properties: z.object({
							accidents_count: z.number(),
							ranking: z.number(),
							street_name: z.string(),
							extension_km: z.number().optional(),
						}),
					}),
				),
			}),
			"Streets GeoJSON data",
		),
	},
});

export const streetProfiles = createRoute({
	path: "/unsafe-streets/streets/{street_name}/profiles",
	method: "get",
	tags,
	summary: "Get victim profiles for street",
	description:
		"Get victim profiles by gender, age, and accident type for a specific street",
	request: {
		params: z.object({
			street_name: z.string().openapi({
				description: "Street name",
				example: "Av. Boa Viagem",
			}),
		}),
		query: z.object({
			city: z.string().optional().openapi({
				description: "City name for filtering",
				example: "RECIFE",
			}),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				street_name: z.string(),
				victim_profiles: z.object({
					by_gender: z.record(z.number()),
					by_age_group: z.record(z.number()),
					by_accident_type: z.record(z.number()),
				}),
			}),
			"Street victim profiles",
		),
	},
});

export const streetGeoJSON = createRoute({
	path: "/unsafe-streets/streets/{street_name}/geojson",
	method: "get",
	tags,
	summary: "Get street GeoJSON",
	description: "Get geospatial data for a specific street",
	request: {
		params: z.object({
			street_name: z.string().openapi({
				description: "Street name",
				example: "Av. Boa Viagem",
			}),
		}),
		query: z.object({
			city: z.string().optional().openapi({
				description: "City name for filtering",
				example: "RECIFE",
			}),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				type: z.literal("FeatureCollection"),
				features: z.array(
					z.object({
						type: z.literal("Feature"),
						geometry: z.object({
							type: z.string(),
							coordinates: z.any(),
						}),
						properties: z.object({
							street_name: z.string(),
							accidents_count: z.number(),
							extension_km: z.number().optional(),
						}),
					}),
				),
			}),
			"Street GeoJSON data",
		),
	},
});

export const streetEvolution = createRoute({
	path: "/unsafe-streets/streets/{street_name}/evolution",
	method: "get",
	tags,
	summary: "Get street accident evolution",
	description: "Get temporal evolution of accidents for a specific street",
	request: {
		params: z.object({
			street_name: z.string().openapi({
				description: "Street name",
				example: "Av. Boa Viagem",
			}),
		}),
		query: z.object({
			city: z.string().optional().openapi({
				description: "City name for filtering",
				example: "RECIFE",
			}),
			start_year: z.coerce.number().optional().openapi({
				description: "Start year",
				example: 2020,
			}),
			end_year: z.coerce.number().optional().openapi({
				description: "End year",
				example: 2022,
			}),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				street_name: z.string(),
				period: z.object({
					start_year: z.number(),
					end_year: z.number(),
				}),
				by_month: z.record(z.number()),
				by_weekday: z.record(z.number()),
				by_hour: z.record(z.number()),
			}),
			"Street accident evolution",
		),
	},
});

export const streetRecords = createRoute({
	path: "/unsafe-streets/streets/{street_name}/records",
	method: "get",
	tags,
	summary: "Get street accident records",
	description: "Get individual accident records for a specific street",
	request: {
		params: z.object({
			street_name: z.string().openapi({
				description: "Street name",
				example: "Av. Boa Viagem",
			}),
		}),
		query: z.object({
			city: z.string().optional().openapi({
				description: "City name for filtering",
				example: "RECIFE",
			}),
			year: z.coerce.number().optional().openapi({
				description: "Year filter",
				example: 2022,
			}),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				street_name: z.string(),
				year: z.number().optional(),
				records: z.array(
					z.object({
						datetime: z.string(),
						category: z.string(),
						gender: z.string(),
						age: z.number().nullable(),
						outcome: z.string(),
					}),
				),
			}),
			"Street accident records",
		),
	},
});

export type CitySummaryRoute = typeof citySummary;
export type StreetSummaryRoute = typeof streetSummary;
export type CityConcentrationRoute = typeof cityConcentration;
export type CityGeoJSONRoute = typeof cityGeoJSON;
export type StreetProfilesRoute = typeof streetProfiles;
export type StreetGeoJSONRoute = typeof streetGeoJSON;
export type StreetEvolutionRoute = typeof streetEvolution;
export type StreetRecordsRoute = typeof streetRecords;
