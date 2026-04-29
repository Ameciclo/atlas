import { and, eq, sql, sum } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { trafficDeaths } from "../../db/schema.js";
import type { AppRouteHandler } from "../../lib/types.js";
import type * as routes from "./by-transport-mode.routes.js";

// Transport mode definitions based on CID-10 codes
const TRANSPORT_MODES = [
	{
		mode: "Pedestre",
		cid10_codes: "V01-V09",
		pattern: "V0%",
	},
	{
		mode: "Ciclista",
		cid10_codes: "V10-V19",
		pattern: "V1%",
	},
	{
		mode: "Motociclista",
		cid10_codes: "V20-V29",
		pattern: "V2%",
	},
	{
		mode: "Ocupante de triciclo",
		cid10_codes: "V30-V39",
		pattern: "V3%",
	},
	{
		mode: "Ocupante de automóvel",
		cid10_codes: "V40-V49",
		pattern: "V4%",
	},
	{
		mode: "Ocupante de caminhonete",
		cid10_codes: "V50-V59",
		pattern: "V5%",
	},
	{
		mode: "Ocupante de veículo pesado",
		cid10_codes: "V60-V69",
		pattern: "V6%",
	},
	{
		mode: "Ocupante de ônibus",
		cid10_codes: "V70-V79",
		pattern: "V7%",
	},
	{
		mode: "Outros modos",
		cid10_codes: "V80-V89",
		pattern: "V8%",
	},
	{
		mode: "Não especificado",
		cid10_codes: "V99",
		pattern: "V99%",
	},
] as const;

export const getDeathsByTransportMode: AppRouteHandler<
	typeof routes.getDeathsByTransportMode
> = async (c) => {
	const db = c.get("db");
	const {
		year,
		city_code,
		location_type = "occurrence",
	} = c.req.valid("query");

	// Determine which field to use based on location_type
	const cityCodeField =
		location_type === "occurrence"
			? trafficDeaths.codmunocor
			: trafficDeaths.codmunres;

	// Build base conditions with explicit type
	const conditions: ReturnType<typeof eq>[] = [];
	if (year) {
		conditions.push(eq(trafficDeaths.data_year, year));
	}
	if (city_code) {
		conditions.push(eq(cityCodeField, city_code));
	}

	// Use a single query with CASE statements to count deaths by transport mode
	// This is much more efficient than running 10 separate queries
	const result = await db
		.select({
			pedestrian: sum(
				sql`CASE WHEN ${trafficDeaths.causabas} LIKE 'V0%' THEN 1 ELSE 0 END`,
			),
			cyclist: sum(
				sql`CASE WHEN ${trafficDeaths.causabas} LIKE 'V1%' THEN 1 ELSE 0 END`,
			),
			motorcyclist: sum(
				sql`CASE WHEN ${trafficDeaths.causabas} LIKE 'V2%' THEN 1 ELSE 0 END`,
			),
			tricycle: sum(
				sql`CASE WHEN ${trafficDeaths.causabas} LIKE 'V3%' THEN 1 ELSE 0 END`,
			),
			car: sum(
				sql`CASE WHEN ${trafficDeaths.causabas} LIKE 'V4%' THEN 1 ELSE 0 END`,
			),
			pickup: sum(
				sql`CASE WHEN ${trafficDeaths.causabas} LIKE 'V5%' THEN 1 ELSE 0 END`,
			),
			heavy_vehicle: sum(
				sql`CASE WHEN ${trafficDeaths.causabas} LIKE 'V6%' THEN 1 ELSE 0 END`,
			),
			bus: sum(
				sql`CASE WHEN ${trafficDeaths.causabas} LIKE 'V7%' THEN 1 ELSE 0 END`,
			),
			other: sum(
				sql`CASE WHEN ${trafficDeaths.causabas} LIKE 'V8%' THEN 1 ELSE 0 END`,
			),
			unspecified: sum(
				sql`CASE WHEN ${trafficDeaths.causabas} LIKE 'V99%' THEN 1 ELSE 0 END`,
			),
		})
		.from(trafficDeaths)
		.where(conditions.length > 0 ? and(...conditions) : undefined);

	// Map the results to the transport modes array
	const counts = result[0];
	const results = TRANSPORT_MODES.map((mode, index) => {
		const key = [
			"pedestrian",
			"cyclist",
			"motorcyclist",
			"tricycle",
			"car",
			"pickup",
			"heavy_vehicle",
			"bus",
			"other",
			"unspecified",
		][index] as keyof typeof counts;

		return {
			mode: mode.mode,
			cid10_codes: mode.cid10_codes,
			total_deaths: Number(counts?.[key] ?? 0),
		};
	});

	// Calculate total and percentages
	const total = results.reduce((sum, r) => sum + r.total_deaths, 0);

	const transport_modes = results
		.map((r) => ({
			...r,
			percentage:
				total > 0
					? Number.parseFloat(((r.total_deaths / total) * 100).toFixed(2))
					: 0,
		}))
		.filter((r) => r.total_deaths > 0) // Only include modes with deaths
		.sort((a, b) => b.total_deaths - a.total_deaths); // Sort by total descending

	return c.json(
		{
			year: year ?? null,
			city_code: city_code ?? null,
			location_type,
			transport_modes,
			total,
		},
		HttpStatusCodes.OK,
	);
};
