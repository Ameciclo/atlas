import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
	streetCodes,
	pcrStreets,
	trafficViolations,
	violationCategories,
} from "../../db/schema.js";
import {
	AGENT_INFO,
	buildConditions,
} from "../../lib/query-helpers.js";
import type * as routes from "./dashboard.routes.js";

// ============================================================================
// 1. Overview
// ============================================================================

export const overview = async (c: any) => {
	try {
		const [totalResult] = await db
			.select({ count: count() })
			.from(trafficViolations);

		const [periodResult] = await db
			.select({
				start: sql<string>`MIN(${trafficViolations.violation_date})::date::text`,
				end: sql<string>`MAX(${trafficViolations.violation_date})::date::text`,
			})
			.from(trafficViolations);

		const [typesResult] = await db
			.select({ count: count() })
			.from(
				db
					.selectDistinct({ code: trafficViolations.violation_code })
					.from(trafficViolations)
					.as("distinct_codes"),
			);

		const [streetsResult] = await db
			.select({ count: count() })
			.from(streetCodes);

		const [lawCodesResult] = await db
			.select({ count: count() })
			.from(
				db
					.selectDistinct({ law: trafficViolations.law_code })
					.from(trafficViolations)
					.where(sql`${trafficViolations.law_code} IS NOT NULL`)
					.as("distinct_law_codes"),
			);

		const total = totalResult?.count || 0;

		const agentData = await db
			.select({
				agent_id: trafficViolations.agent_id,
				count: count(),
			})
			.from(trafficViolations)
			.groupBy(trafficViolations.agent_id)
			.orderBy(desc(count()));

		const agentBreakdown = agentData.map((a) => {
			const info = AGENT_INFO[a.agent_id] ?? {
				description: `Agente ${a.agent_id}`,
				category: "manual" as const,
			};
			return {
				agent_id: a.agent_id,
				description: info.description,
				count: a.count,
				percentage: total > 0 ? Math.round((a.count / total) * 1000) / 10 : 0,
				category: info.category,
			};
		});

		return c.json(
			{
				total_violations: total,
				period_start: periodResult?.start || null,
				period_end: periodResult?.end || null,
				violation_types_count: typesResult?.count || 0,
				law_codes_count: lawCodesResult?.count || 0,
				streets_count: streetsResult?.count || 0,
				neighborhoods_count: 0,
				agent_breakdown: agentBreakdown,
			},
			200,
		);
	} catch (error) {
		console.error("Error fetching overview:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};

// ============================================================================
// 2. Top Violations
// ============================================================================

export const topViolations = async (c: any) => {
	const {
		violation_codes,
		category,
		agent_category,
		limit,
		start_date,
		end_date,
	} = c.req.valid("query");

	try {
		const whereClause = await buildConditions({
			codes: violation_codes,
			category: category,
			agentCategory: agent_category,
			startDate: start_date,
			endDate: end_date,
		});

		const [totalResult] = await db
			.select({ count: count() })
			.from(trafficViolations)
			.where(whereClause);

		const total = totalResult?.count || 0;

		const data = await db
			.select({
				violation_code: trafficViolations.violation_code,
				law_code: sql<string>`MAX(${trafficViolations.law_code})`,
				description: sql<string>`MAX(${trafficViolations.description})`,
				count: count(),
			})
			.from(trafficViolations)
			.where(whereClause)
			.groupBy(trafficViolations.violation_code)
			.orderBy(desc(count()))
			.limit(limit);

		const violations = data.map((v) => ({
			violation_code: v.violation_code,
			law_code: v.law_code,
			description: v.description,
			count: v.count,
			percentage: total > 0 ? Math.round((v.count / total) * 1000) / 10 : 0,
		}));

		return c.json({ violations }, 200);
	} catch (error) {
		console.error("Error fetching top violations:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};

// ============================================================================
// 3. Top Streets
// ============================================================================

export const topStreets = async (c: any) => {
	const {
		violation_codes,
		category,
		agent_category,
		limit,
		start_date,
		end_date,
	} = c.req.valid("query");

	try {
		const whereClause = await buildConditions({
			codes: violation_codes,
			category: category,
			agentCategory: agent_category,
			startDate: start_date,
			endDate: end_date,
		});

		const data = await db
			.select({
				street_code: trafficViolations.street_code,
				official_name: streetCodes.official_name,
				total_violations: count(),
			})
			.from(trafficViolations)
			.innerJoin(
				streetCodes,
				eq(trafficViolations.street_code, streetCodes.code),
			)
			.where(whereClause)
			.groupBy(
				trafficViolations.street_code,
				streetCodes.official_name,
			)
			.orderBy(desc(count()))
			.limit(limit);

		const streetCodeList = data
			.map((s) => s.street_code)
			.filter((c): c is number => c != null);

		let lengthMap = new Map<number, number>();
		if (streetCodeList.length > 0) {
			const lengths = await db
				.select({
					street_code: pcrStreets.clogra_codi,
					total_km: sql<number>`SUM(${pcrStreets.db2gse_sde}) / 1000.0`,
				})
				.from(pcrStreets)
				.where(inArray(pcrStreets.clogra_codi, streetCodeList))
				.groupBy(pcrStreets.clogra_codi);
			lengthMap = new Map(
				lengths.map((l) => [l.street_code, Number(l.total_km)]),
			);
		}

		// Get top violation per street
		const topViolationMap = new Map<
			number,
			{
				violation_code: string;
				law_code: string;
				description: string;
				count: number;
			}
		>();
		for (const s of data) {
			const code = s.street_code;
			if (!code) continue;

			const [top] = await db
				.select({
					violation_code: trafficViolations.violation_code,
					law_code: sql<string>`MAX(${trafficViolations.law_code})`,
					description: sql<string>`MAX(${trafficViolations.description})`,
					count: count(),
				})
				.from(trafficViolations)
				.where(
					and(
						eq(trafficViolations.street_code, code),
						...(whereClause ? [whereClause] : []),
					),
				)
				.groupBy(trafficViolations.violation_code)
				.orderBy(desc(count()))
				.limit(1);

			if (top) {
				topViolationMap.set(code, {
					violation_code: top.violation_code,
					law_code: top.law_code,
					description: top.description,
					count: top.count,
				});
			}
		}

		const streets = data.map((s) => {
			const totalKm = lengthMap.get(s.street_code || 0) || 0;
			const topViol = topViolationMap.get(s.street_code || 0);

			return {
				street_code: s.street_code || 0,
				official_name: s.official_name,
				total_violations: s.total_violations,
				extension_km: Math.round(totalKm * 100) / 100,
				violations_per_km:
					totalKm > 0
						? Math.round((s.total_violations / totalKm) * 100) / 100
						: 0,
				top_violation: topViol
					? {
							violation_code: topViol.violation_code,
							law_code: topViol.law_code,
							description: topViol.description,
							count: topViol.count,
							percentage:
								s.total_violations > 0
									? Math.round((topViol.count / s.total_violations) * 1000) / 10
									: 0,
						}
					: null,
			};
		});

		return c.json({ streets }, 200);
	} catch (error) {
		console.error("Error fetching top streets:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};

// ============================================================================
// 4. Temporal
// ============================================================================

export const temporal = async (c: any) => {
	const { violation_codes, category, agent_category, start_date, end_date } =
		c.req.valid("query");

	try {
		const whereClause = await buildConditions({
			codes: violation_codes,
			category: category,
			agentCategory: agent_category,
			startDate: start_date,
			endDate: end_date,
		});

		const yearlyData = await db
			.select({
				year: sql<string>`EXTRACT(YEAR FROM ${trafficViolations.violation_date})::text`,
				count: count(),
			})
			.from(trafficViolations)
			.where(whereClause)
			.groupBy(sql`EXTRACT(YEAR FROM ${trafficViolations.violation_date})`)
			.orderBy(sql`EXTRACT(YEAR FROM ${trafficViolations.violation_date})`);

		const monthlyData = await db
			.select({
				month: sql<string>`EXTRACT(MONTH FROM ${trafficViolations.violation_date})::text`,
				count: count(),
			})
			.from(trafficViolations)
			.where(whereClause)
			.groupBy(sql`EXTRACT(MONTH FROM ${trafficViolations.violation_date})`)
			.orderBy(sql`EXTRACT(MONTH FROM ${trafficViolations.violation_date})`);

		const weekdayData = await db
			.select({
				weekday: sql<string>`TO_CHAR(${trafficViolations.violation_date}, 'Day')`,
				count: count(),
				dow: sql<number>`EXTRACT(DOW FROM ${trafficViolations.violation_date})`,
			})
			.from(trafficViolations)
			.where(whereClause)
			.groupBy(
				sql`TO_CHAR(${trafficViolations.violation_date}, 'Day')`,
				sql`EXTRACT(DOW FROM ${trafficViolations.violation_date})`,
			)
			.orderBy(sql`EXTRACT(DOW FROM ${trafficViolations.violation_date})`);

		const hourlyData = await db
			.select({
				hour: sql<string>`EXTRACT(HOUR FROM ${trafficViolations.violation_date})::text`,
				count: count(),
			})
			.from(trafficViolations)
			.where(whereClause)
			.groupBy(sql`EXTRACT(HOUR FROM ${trafficViolations.violation_date})`)
			.orderBy(sql`EXTRACT(HOUR FROM ${trafficViolations.violation_date})`);

		const byYear: Record<string, number> = {};
		for (const y of yearlyData) {
			byYear[y.year] = y.count;
		}

		const byMonth: Record<string, number> = {};
		for (const m of monthlyData) {
			byMonth[m.month.padStart(2, "0")] = m.count;
		}

		const byWeekday: Record<string, number> = {};
		for (const w of weekdayData) {
			byWeekday[w.weekday.trim().toLowerCase()] = w.count;
		}

		const byHour: Record<string, number> = {};
		for (const h of hourlyData) {
			byHour[h.hour.padStart(2, "0")] = h.count;
		}

		return c.json(
			{
				by_year: byYear,
				by_month: byMonth,
				by_weekday: byWeekday,
				by_hour: byHour,
			},
			200,
		);
	} catch (error) {
		console.error("Error fetching temporal data:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};

// ============================================================================
// 5. Agent Analysis
// ============================================================================

export const agentAnalysis = async (c: any) => {
	const { violation_codes, category, start_date, end_date } =
		c.req.valid("query");

	try {
		const baseWhere = await buildConditions({
			codes: violation_codes,
			category: category,
			startDate: start_date,
			endDate: end_date,
		});

		const [totalResult] = await db
			.select({ count: count() })
			.from(trafficViolations)
			.where(baseWhere);

		const total = totalResult?.count || 0;

		const agentData = await db
			.select({
				agent_id: trafficViolations.agent_id,
				count: count(),
			})
			.from(trafficViolations)
			.where(baseWhere)
			.groupBy(trafficViolations.agent_id)
			.orderBy(desc(count()));

		const agents = await Promise.all(
			agentData.map(async (a) => {
				const info = AGENT_INFO[a.agent_id] ?? {
					description: `Agente ${a.agent_id}`,
					category: "manual" as const,
				};

				const topViols = await db
					.select({
						violation_code: trafficViolations.violation_code,
						law_code: sql<string>`MAX(${trafficViolations.law_code})`,
						description: sql<string>`MAX(${trafficViolations.description})`,
						count: count(),
					})
					.from(trafficViolations)
					.where(
						and(
							eq(trafficViolations.agent_id, a.agent_id),
							...(baseWhere ? [baseWhere] : []),
						),
					)
					.groupBy(trafficViolations.violation_code)
					.orderBy(desc(count()))
					.limit(5);

				return {
					agent_id: a.agent_id,
					description: info.description,
					category: info.category,
					total: a.count,
					percentage: total > 0 ? Math.round((a.count / total) * 1000) / 10 : 0,
					top_violations: topViols.map((v) => ({
						violation_code: v.violation_code,
						law_code: v.law_code,
						description: v.description,
						count: v.count,
					})),
				};
			}),
		);

		return c.json({ agents }, 200);
	} catch (error) {
		console.error("Error fetching agent analysis:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};

// ============================================================================
// 6. Violation Codes Dictionary
// ============================================================================

export const violationCodes = async (c: any) => {
	try {
		const data = await db
			.select({
				violation_code: trafficViolations.violation_code,
				law_code: sql<string>`MAX(${trafficViolations.law_code})`,
				description: sql<string>`MAX(${trafficViolations.description})`,
				count: count(),
				category: sql<string>`MAX(${violationCategories.category})`,
			})
			.from(trafficViolations)
			.leftJoin(
				violationCategories,
				and(
					eq(
						trafficViolations.violation_code,
						violationCategories.violation_code,
					),
					isNull(violationCategories.description_keyword),
				),
			)
			.groupBy(trafficViolations.violation_code)
			.orderBy(desc(count()));

		return c.json(
			{
				codes: data.map((v) => ({
					violation_code: v.violation_code,
					law_code: v.law_code,
					description: v.description,
					category: v.category || "",
					count: v.count,
				})),
			},
			200,
		);
	} catch (error) {
		console.error("Error fetching violation codes:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};

// ============================================================================
// 7. Categories List
// ============================================================================

export const categoriesList = async (c: any) => {
	try {
		const data = await db
			.select({
				category: violationCategories.category,
				code_count: sql<number>`COUNT(DISTINCT ${violationCategories.violation_code})`,
			})
			.from(violationCategories)
			.groupBy(violationCategories.category)
			.orderBy(violationCategories.category);

		// Get total violations per category
		const categories = await Promise.all(
			data.map(async (cat) => {
				const codes = await db
					.selectDistinct({ code: violationCategories.violation_code })
					.from(violationCategories)
					.where(eq(violationCategories.category, cat.category));

				const codeList = codes.map((c) => c.code);
				let totalViolations = 0;

				if (codeList.length > 0) {
					const [result] = await db
						.select({ count: count() })
						.from(trafficViolations)
						.where(inArray(trafficViolations.violation_code, codeList));
					totalViolations = result?.count || 0;
				}

				return {
					category: cat.category,
					code_count: cat.code_count,
					total_violations: totalViolations,
				};
			}),
		);

		return c.json({ categories }, 200);
	} catch (error) {
		console.error("Error fetching categories:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};
