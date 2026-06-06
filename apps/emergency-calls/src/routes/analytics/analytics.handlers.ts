import { sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import type { AppRouteHandler } from "../../lib/types.js";
import type {
	AccidentTypesRoute,
	DangerousStreetsRoute,
	GenderDistributionRoute,
	MunicipalityStatsRoute,
} from "./analytics.routes.js";

export const municipalityStats: AppRouteHandler<
	MunicipalityStatsRoute
> = async (c) => {

	const result = await db.execute(sql`
		SELECT 
			municipality, 
			COUNT(*) as call_count
		FROM emergency_calls 
		WHERE municipality IS NOT NULL
		GROUP BY municipality 
		ORDER BY call_count DESC 
		LIMIT 10
	`);
	return c.json(result.rows as { municipality: string; call_count: number }[]);
};

export const accidentTypes: AppRouteHandler<AccidentTypesRoute> = async (c) => {

	const result = await db.execute(sql`
		SELECT 
			subtype, 
			COUNT(*) as count
		FROM emergency_calls 
		WHERE subtype IS NOT NULL
		GROUP BY subtype 
		ORDER BY count DESC 
		LIMIT 10
	`);
	return c.json(result.rows as { subtype: string; count: number }[]);
};

export const genderDistribution: AppRouteHandler<
	GenderDistributionRoute
> = async (c) => {

	const result = await db.execute(sql`
		SELECT 
			gender, 
			COUNT(*) as count,
			ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM emergency_calls), 2) as percentage
		FROM emergency_calls 
		GROUP BY gender 
		ORDER BY count DESC
	`);
	return c.json(
		result.rows as {
			gender: string | null;
			count: number;
			percentage: number;
		}[],
	);
};

export const dangerousStreets: AppRouteHandler<DangerousStreetsRoute> = async (
	c,
) => {

	const { sort_by, limit } = c.req.valid("query");

	const orderBy =
		sort_by === "fatality_rate"
			? "fatality_rate DESC, total_accidents DESC"
			: "total_accidents DESC";

	const minAccidents = sort_by === "fatality_rate" ? 3 : 5;
	const fatalityFilter =
		sort_by === "fatality_rate"
			? "AND COUNT(CASE WHEN outcome_reason LIKE '%bito%' THEN 1 END) > 0"
			: "";

	const result = await db.execute(
		sql.raw(`
		SELECT 
			COALESCE(pcr_address, address) as street,
			COUNT(*) as total_accidents,
			COUNT(CASE WHEN outcome_reason LIKE '%bito%' THEN 1 END) as fatal_cases,
			ROUND(COUNT(CASE WHEN outcome_reason LIKE '%bito%' THEN 1 END) * 100.0 / COUNT(*), 2) as fatality_rate
		FROM emergency_calls 
		WHERE municipality = 'RECIFE' 
			AND (pcr_address IS NOT NULL OR address IS NOT NULL)
			AND (pcr_address != '' OR address != '')
		GROUP BY COALESCE(pcr_address, address)
		HAVING COUNT(*) >= ${minAccidents} ${fatalityFilter}
		ORDER BY ${orderBy}
		LIMIT ${limit}
	`),
	);

	return c.json(
		result.rows as {
			street: string;
			total_accidents: number;
			fatal_cases: number;
			fatality_rate: number;
		}[],
	);
};
