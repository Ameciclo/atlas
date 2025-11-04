import { and, between, count, eq, like, or } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { db } from "../../db/index.js";
import { trafficDeaths } from "../../db/schema.js";
import type { AppRouteHandler } from "../../lib/types.js";
import type * as routes from "./time-series.routes.js";

// Transport mode to CID-10 pattern mapping
const TRANSPORT_MODE_PATTERNS: Record<string, string[]> = {
	pedestrian: ["V0%"],
	cyclist: ["V1%"],
	motorcyclist: ["V2%"],
	tricycle: ["V3%"],
	car: ["V4%"],
	pickup: ["V5%"],
	heavy_vehicle: ["V6%"],
	bus: ["V7%"],
	other: ["V8%"],
	unspecified: ["V99%"],
};

export const getTimeSeries: AppRouteHandler<
	typeof routes.getTimeSeries
> = async (c) => {
	const {
		start_year,
		end_year,
		city_code,
		transport_mode,
		location_type = "occurrence",
	} = c.req.valid("query");

	// Determine year range (default to all available years)
	const actualStartYear = start_year ?? 2015;
	const actualEndYear = end_year ?? new Date().getFullYear();

	// Determine which field to use based on location_type
	const cityCodeField =
		location_type === "occurrence"
			? trafficDeaths.codmunocor
			: trafficDeaths.codmunres;

	// Build conditions array with explicit type
	const conditions: (
		| ReturnType<typeof between>
		| ReturnType<typeof eq>
		| ReturnType<typeof or>
		| ReturnType<typeof like>
	)[] = [between(trafficDeaths.data_year, actualStartYear, actualEndYear)];

	if (city_code) {
		conditions.push(eq(cityCodeField, city_code));
	}

	if (transport_mode) {
		const patterns = TRANSPORT_MODE_PATTERNS[transport_mode];
		if (patterns) {
			const patternConditions = patterns.map((pattern) =>
				like(trafficDeaths.causabas, pattern),
			);
			if (patternConditions.length > 1) {
				const orCondition = or(...patternConditions);
				if (orCondition) {
					conditions.push(orCondition);
				}
			} else if (patternConditions[0]) {
				conditions.push(patternConditions[0]);
			}
		}
	}

	// Query deaths grouped by year
	const results = await db
		.select({
			year: trafficDeaths.data_year,
			total_deaths: count(),
		})
		.from(trafficDeaths)
		.where(and(...conditions))
		.groupBy(trafficDeaths.data_year)
		.orderBy(trafficDeaths.data_year);

	// Fill in missing years with 0 deaths
	const data = [];
	for (let year = actualStartYear; year <= actualEndYear; year++) {
		const yearData = results.find((r) => r.year === year);
		data.push({
			year,
			total_deaths: yearData?.total_deaths ?? 0,
		});
	}

	const total = data.reduce((sum, d) => sum + d.total_deaths, 0);
	const yearCount = actualEndYear - actualStartYear + 1;
	const average_per_year =
		yearCount > 0 ? Number.parseFloat((total / yearCount).toFixed(2)) : 0;

	return c.json(
		{
			start_year: actualStartYear,
			end_year: actualEndYear,
			city_code: city_code ?? null,
			transport_mode: transport_mode ?? null,
			location_type,
			data,
			total,
			average_per_year,
		},
		HttpStatusCodes.OK,
	);
};
