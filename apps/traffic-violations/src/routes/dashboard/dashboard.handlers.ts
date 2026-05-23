import { and, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { trafficViolations, officialStreets, pcrStreets, violationCategories } from "../../db/schema.js";
import type * as routes from "./dashboard.routes.js";

// ============================================================================
// Agent mapping
// ============================================================================

const AGENT_INFO: Record<number, { description: string; category: "eletronico" | "manual" }> = {
	0: { description: "NA", category: "manual" },
	1: { description: "Convênio BPTRAN", category: "manual" },
	2: { description: "Zona Azul - Talão Manual", category: "manual" },
	3: { description: "Lombada Eletrônica", category: "eletronico" },
	4: { description: "Radar", category: "eletronico" },
	5: { description: "Fotosensor", category: "eletronico" },
	6: { description: "Autos no Talão Manual", category: "manual" },
	7: { description: "Zona Azul - Talão Eletrônico", category: "manual" },
	8: { description: "Autos no Talão Eletrônico", category: "manual" },
	9: { description: "Faixa Azul", category: "eletronico" },
};

const ELETRONICO_IDS = [3, 4, 5, 9];
const MANUAL_IDS = [0, 1, 2, 6, 7, 8];

function getAgentIds(category: string): number[] {
	if (category === "eletronico") return ELETRONICO_IDS;
	if (category === "manual") return MANUAL_IDS;
	return [...ELETRONICO_IDS, ...MANUAL_IDS];
}

async function resolveCategoryCodes(category: string | undefined): Promise<string[] | null> {
	if (!category) return null;
	const rows = await db
		.selectDistinct({ code: violationCategories.violation_code })
		.from(violationCategories)
		.where(eq(violationCategories.category, category));
	const codes = rows.map((r) => r.code).filter(Boolean);
	return codes.length > 0 ? codes : null;
}

function parseCodes(raw: string | undefined): string[] | null {
	if (!raw) return null;
	const codes = raw
		.split(",")
		.map((c) => c.trim())
		.filter(Boolean);
	return codes.length > 0 ? codes : null;
}

// ============================================================================
// Shared condition builder
// ============================================================================

async function buildConditions(params: {
	codes?: string | undefined;
	category?: string | undefined;
	agentCategory?: string | undefined;
	startDate?: string | undefined;
	endDate?: string | undefined;
}) {
	const conditions: ReturnType<typeof and>[] = [];

	let codes = parseCodes(params.codes);

	if (!codes && params.category) {
		codes = await resolveCategoryCodes(params.category);
	}

	if (codes) {
		conditions.push(inArray(trafficViolations.violation_code, codes));
	}

	const agentIds = getAgentIds(params.agentCategory || "all");
	if (params.agentCategory && params.agentCategory !== "all") {
		conditions.push(inArray(trafficViolations.agent_id, agentIds));
	}

	if (params.startDate) {
		conditions.push(gte(trafficViolations.violation_date, new Date(params.startDate)));
	}
	if (params.endDate) {
		conditions.push(lte(trafficViolations.violation_date, new Date(params.endDate)));
	}

	return conditions.length > 0 ? and(...conditions) : undefined;
}

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
			.from(officialStreets);

		const [neighborhoodsResult] = await db
			.select({ count: count() })
			.from(
				db
					.selectDistinct({ name: officialStreets.neighborhood_name })
					.from(officialStreets)
					.where(sql`${officialStreets.neighborhood_name} IS NOT NULL`)
					.as("distinct_neighborhoods"),
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

		return c.json({
			total_violations: total,
			period_start: periodResult?.start || null,
			period_end: periodResult?.end || null,
			violation_types_count: typesResult?.count || 0,
			streets_count: streetsResult?.count || 0,
			neighborhoods_count: neighborhoodsResult?.count || 0,
			agent_breakdown: agentBreakdown,
		}, 200);
	} catch (error) {
		console.error("Error fetching overview:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};

// ============================================================================
// 2. Top Violations
// ============================================================================

export const topViolations = async (c: any) => {
	const { violation_codes, category, agent_category, limit, start_date, end_date } =
		c.req.valid("query");

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
	const { violation_codes, category, agent_category, limit, start_date, end_date } =
		c.req.valid("query");

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
				official_name: officialStreets.official_name,
				neighborhood_name: officialStreets.neighborhood_name,
				total_violations: count(),
			})
			.from(trafficViolations)
			.innerJoin(
				officialStreets,
				eq(trafficViolations.street_code, officialStreets.code),
			)
			.where(whereClause)
			.groupBy(
				trafficViolations.street_code,
				officialStreets.official_name,
				officialStreets.neighborhood_name,
			)
			.orderBy(desc(count()))
			.limit(limit);

		const streetCodes = data
			.map((s) => s.street_code)
			.filter((c): c is number => c != null);

		let lengthMap = new Map<number, number>();
		if (streetCodes.length > 0) {
			const lengths = await db
				.select({
					street_code: pcrStreets.clogra_codi,
					total_km: sql<number>`SUM(${pcrStreets.db2gse_sde}) / 1000.0`,
				})
				.from(pcrStreets)
				.where(inArray(pcrStreets.clogra_codi, streetCodes))
				.groupBy(pcrStreets.clogra_codi);
			lengthMap = new Map(lengths.map((l) => [l.street_code, Number(l.total_km)]));
		}

		const streets = data.map((s) => {
			const totalKm = lengthMap.get(s.street_code || 0) || 0;
			return {
				street_code: s.street_code || 0,
				official_name: s.official_name,
				neighborhood_name: s.neighborhood_name,
				total_violations: s.total_violations,
				extension_km: Math.round(totalKm * 100) / 100,
				violations_per_km:
					totalKm > 0
						? Math.round((s.total_violations / totalKm) * 100) / 100
						: 0,
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

		return c.json({ by_month: byMonth, by_weekday: byWeekday, by_hour: byHour }, 200);
	} catch (error) {
		console.error("Error fetching temporal data:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};

// ============================================================================
// 5. Agent Analysis
// ============================================================================

export const agentAnalysis = async (c: any) => {
	const { violation_codes, category, start_date, end_date } = c.req.valid("query");

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
			})
			.from(trafficViolations)
			.groupBy(trafficViolations.violation_code)
			.orderBy(desc(count()));

		return c.json(
			{
				codes: data.map((v) => ({
					violation_code: v.violation_code,
					law_code: v.law_code,
					description: v.description,
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
