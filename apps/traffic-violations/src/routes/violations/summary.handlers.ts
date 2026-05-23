import { and, eq, gte, lte, count, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { trafficViolations } from "../../db/schema.js";

export const summary = async (c: any) => {
	// Get total violations
	const [totalResult] = await db
		.select({ count: count() })
		.from(trafficViolations);

	// Get data period
	const [periodResult] = await db
		.select({
			start: sql<string>`MIN(${trafficViolations.violation_date})::text`,
			end: sql<string>`MAX(${trafficViolations.violation_date})::text`,
		})
		.from(trafficViolations);

	// Get violations per year
	const yearlyData = await db
		.select({
			year: sql<string>`EXTRACT(YEAR FROM ${trafficViolations.violation_date})::text`,
			count: count(),
		})
		.from(trafficViolations)
		.groupBy(sql`EXTRACT(YEAR FROM ${trafficViolations.violation_date})`)
		.orderBy(sql`EXTRACT(YEAR FROM ${trafficViolations.violation_date})`);

	// Get top violation type
	const [topTypeResult] = await db
		.select({
			violation_type_id: trafficViolations.violation_type_id,
			description: trafficViolations.description,
			count: count(),
		})
		.from(trafficViolations)
		.groupBy(trafficViolations.violation_type_id, trafficViolations.description)
		.orderBy(sql`COUNT(*) DESC`)
		.limit(1);

	// Get most active agent
	const [topAgentResult] = await db
		.select({
			agent_id: trafficViolations.agent_id,
			count: count(),
		})
		.from(trafficViolations)
		.groupBy(trafficViolations.agent_id)
		.orderBy(sql`COUNT(*) DESC`)
		.limit(1);

	const violationsPerYear = yearlyData.reduce(
		(acc, item) => {
			acc[item.year] = item.count;
			return acc;
		},
		{} as Record<string, number>,
	);

	return c.json({
		total_violations: totalResult?.count || 0,
		data_period: {
			start: periodResult?.start?.split("T")[0] || "",
			end: periodResult?.end?.split("T")[0] || "",
		},
		violations_per_year: violationsPerYear,
		top_violation_type: {
			id: topTypeResult?.violation_type_id || 0,
			description: topTypeResult?.description || "",
			total: topTypeResult?.count || 0,
		},
		most_active_agent: {
			id: topAgentResult?.agent_id || 0,
			total_violations: topAgentResult?.count || 0,
		},
	});
};

export const byType = async (c: any) => {
	const { start_date, end_date, limit } = c.req.valid("query");

	// Build conditions
	const conditions: any[] = [];
	if (start_date) {
		conditions.push(
			gte(trafficViolations.violation_date, new Date(start_date)),
		);
	}
	if (end_date) {
		conditions.push(lte(trafficViolations.violation_date, new Date(end_date)));
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Get total for percentage calculation
	const [totalResult] = await db
		.select({ count: count() })
		.from(trafficViolations)
		.where(whereClause);

	// Get violations by type
	const typeData = await db
		.select({
			violation_type_id: trafficViolations.violation_type_id,
			description: trafficViolations.description,
			count: count(),
		})
		.from(trafficViolations)
		.where(whereClause)
		.groupBy(trafficViolations.violation_type_id, trafficViolations.description)
		.orderBy(sql`COUNT(*) DESC`)
		.limit(limit);

	const violationTypes = await Promise.all(
		typeData.map(async (type) => {
			// Get yearly data for this type
			const yearlyData = await db
				.select({
					year: sql<string>`EXTRACT(YEAR FROM ${trafficViolations.violation_date})::text`,
					count: count(),
				})
				.from(trafficViolations)
				.where(
					and(
						eq(trafficViolations.violation_type_id, type.violation_type_id),
						...(conditions.length > 0 ? conditions : ([] as any[])),
					),
				)
				.groupBy(sql`EXTRACT(YEAR FROM ${trafficViolations.violation_date})`)
				.orderBy(sql`EXTRACT(YEAR FROM ${trafficViolations.violation_date})`);

			const violationsPerYear = yearlyData.reduce(
				(acc, item) => {
					acc[item.year] = item.count;
					return acc;
				},
				{} as Record<string, number>,
			);

			return {
				violation_type_id: type.violation_type_id,
				description: type.description,
				total_violations: type.count,
				percentage: totalResult?.count
					? Number(((type.count / totalResult.count) * 100).toFixed(1))
					: 0,
				violations_per_year: violationsPerYear,
			};
		}),
	);

	return c.json({ violation_types: violationTypes });
};

export const byAgent = async (c: any) => {
	const { start_date, end_date, limit } = c.req.valid("query");

	// Build conditions
	const conditions: any[] = [];
	if (start_date) {
		conditions.push(
			gte(trafficViolations.violation_date, new Date(start_date)),
		);
	}
	if (end_date) {
		conditions.push(lte(trafficViolations.violation_date, new Date(end_date)));
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Get agents ranking
	const agentData = await db
		.select({
			agent_id: trafficViolations.agent_id,
			count: count(),
		})
		.from(trafficViolations)
		.where(whereClause)
		.groupBy(trafficViolations.agent_id)
		.orderBy(sql`COUNT(*) DESC`)
		.limit(limit);

	const agents = await Promise.all(
		agentData.map(async (agent, index) => {
			// Get monthly data for this agent
			const monthlyData = await db
				.select({
					month: sql<string>`TO_CHAR(${trafficViolations.violation_date}, 'YYYY-MM')`,
					count: count(),
				})
				.from(trafficViolations)
				.where(
					and(
						eq(trafficViolations.agent_id, agent.agent_id),
						...(conditions.length > 0 ? conditions : ([] as any[])),
					),
				)
				.groupBy(sql`TO_CHAR(${trafficViolations.violation_date}, 'YYYY-MM')`)
				.orderBy(sql`TO_CHAR(${trafficViolations.violation_date}, 'YYYY-MM')`);

			const violationsPerMonth = monthlyData.reduce(
				(acc, item) => {
					acc[item.month] = item.count;
					return acc;
				},
				{} as Record<string, number>,
			);

			return {
				agent_id: agent.agent_id,
				total_violations: agent.count,
				ranking: index + 1,
				violations_per_month: violationsPerMonth,
			};
		}),
	);

	return c.json({ agents });
};

export const temporalAnalysis = async (c: any) => {
	const { start_date, end_date, violation_type_id } = c.req.valid("query");

	// Build conditions
	const conditions: any[] = [];
	if (start_date) {
		conditions.push(
			gte(trafficViolations.violation_date, new Date(start_date)),
		);
	}
	if (end_date) {
		conditions.push(lte(trafficViolations.violation_date, new Date(end_date)));
	}
	if (violation_type_id) {
		conditions.push(eq(trafficViolations.violation_type_id, violation_type_id));
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Get monthly data
	const monthlyData = await db
		.select({
			month: sql<string>`EXTRACT(MONTH FROM ${trafficViolations.violation_date})::text`,
			count: count(),
		})
		.from(trafficViolations)
		.where(whereClause)
		.groupBy(sql`EXTRACT(MONTH FROM ${trafficViolations.violation_date})`)
		.orderBy(sql`EXTRACT(MONTH FROM ${trafficViolations.violation_date})`);

	// Get weekday data
	const weekdayData = await db
		.select({
			weekday: sql<string>`TO_CHAR(${trafficViolations.violation_date}, 'Day')`,
			count: count(),
		})
		.from(trafficViolations)
		.where(whereClause)
		.groupBy(sql`TO_CHAR(${trafficViolations.violation_date}, 'Day')`)
		.orderBy(sql`EXTRACT(DOW FROM ${trafficViolations.violation_date})`);

	// Get hourly data
	const hourlyData = await db
		.select({
			hour: sql<string>`EXTRACT(HOUR FROM ${trafficViolations.violation_date})::text`,
			count: count(),
		})
		.from(trafficViolations)
		.where(whereClause)
		.groupBy(sql`EXTRACT(HOUR FROM ${trafficViolations.violation_date})`)
		.orderBy(sql`EXTRACT(HOUR FROM ${trafficViolations.violation_date})`);

	const byMonth = monthlyData.reduce(
		(acc, item) => {
			acc[item.month.padStart(2, "0")] = item.count;
			return acc;
		},
		{} as Record<string, number>,
	);

	const byWeekday = weekdayData.reduce(
		(acc, item) => {
			acc[item.weekday.trim().toLowerCase()] = item.count;
			return acc;
		},
		{} as Record<string, number>,
	);

	const byHour = hourlyData.reduce(
		(acc, item) => {
			acc[item.hour] = item.count;
			return acc;
		},
		{} as Record<string, number>,
	);

	return c.json({
		period: {
			start: start_date || "2020-01-01",
			end: end_date || "2023-12-31",
		},
		by_month: byMonth,
		by_weekday: byWeekday,
		by_hour: byHour,
	});
};
