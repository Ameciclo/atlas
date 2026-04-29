import { and, count, eq, max, min } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { trafficDeaths } from "../../db/schema.js";
import type { AppRouteHandler } from "../../lib/types.js";
import type * as routes from "./stats.routes.js";

export const getStats: AppRouteHandler<typeof routes.getStats> = async (c) => {
	const db = c.get("db");
	const { city_code, location_type = "occurrence" } = c.req.valid("query");

	// Determine which field to use based on location_type
	const cityCodeField =
		location_type === "occurrence"
			? trafficDeaths.codmunocor
			: trafficDeaths.codmunres;

	// Build base conditions with explicit type
	const baseConditions: ReturnType<typeof eq>[] = [];
	if (city_code) {
		baseConditions.push(eq(cityCodeField, city_code));
	}

	// Get year range
	const yearRangeResult = await db
		.select({
			min_year: min(trafficDeaths.data_year),
			max_year: max(trafficDeaths.data_year),
		})
		.from(trafficDeaths)
		.where(baseConditions.length > 0 ? and(...baseConditions) : undefined);

	const minYear = yearRangeResult[0]?.min_year ?? 2015;
	const maxYear = yearRangeResult[0]?.max_year ?? new Date().getFullYear();

	// Get deaths by year
	const yearlyDeaths = await db
		.select({
			year: trafficDeaths.data_year,
			total: count(),
		})
		.from(trafficDeaths)
		.where(baseConditions.length > 0 ? and(...baseConditions) : undefined)
		.groupBy(trafficDeaths.data_year)
		.orderBy(trafficDeaths.data_year);

	// Latest year stats
	const latestYearData = yearlyDeaths.find((d) => d.year === maxYear);
	const previousYearData = yearlyDeaths.find((d) => d.year === maxYear - 1);

	const latest_year_deaths = latestYearData?.total ?? 0;
	const previous_year_deaths = previousYearData?.total ?? 0;

	const growth_percentage =
		previous_year_deaths > 0
			? Number.parseFloat(
					(
						((latest_year_deaths - previous_year_deaths) /
							previous_year_deaths) *
						100
					).toFixed(2),
				)
			: 0;

	// Most violent year
	const mostViolentYearData = yearlyDeaths.reduce(
		(max, current) => (current.total > max.total ? current : max),
		yearlyDeaths[0] ?? { year: maxYear, total: 0 },
	);

	// Last 5 years stats
	const last5YearsStart = maxYear - 4;
	const last5YearsData = yearlyDeaths.filter(
		(d) => d.year !== null && d.year >= last5YearsStart && d.year <= maxYear,
	);
	const last5YearsTotal = last5YearsData.reduce((sum, d) => sum + d.total, 0);
	const last5YearsAverage = Number.parseFloat((last5YearsTotal / 5).toFixed(2));

	// All time stats
	const allTimeTotal = yearlyDeaths.reduce((sum, d) => sum + d.total, 0);
	const yearsCovered = maxYear - minYear + 1;
	const allTimeAverage = Number.parseFloat(
		(allTimeTotal / yearsCovered).toFixed(2),
	);

	return c.json(
		{
			city_code: city_code ?? null,
			location_type,
			latest_year: maxYear,
			latest_year_deaths,
			previous_year_deaths,
			growth_percentage,
			most_violent_year: {
				year: mostViolentYearData.year ?? maxYear,
				total_deaths: mostViolentYearData.total,
			},
			last_5_years: {
				total_deaths: last5YearsTotal,
				average_per_year: last5YearsAverage,
			},
			all_time: {
				total_deaths: allTimeTotal,
				years_covered: yearsCovered,
				average_per_year: allTimeAverage,
			},
		},
		HttpStatusCodes.OK,
	);
};
