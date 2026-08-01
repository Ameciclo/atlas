import { sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { officialStreets, pcrStreets } from "../../db/schema.js";
import { AGENT_INFO } from "../../lib/query-helpers.js";

function q(sqlStr: string) {
	return db.execute(sql.raw(sqlStr));
}

function sumArrays(arrays: number[][]): number[] {
	if (arrays.length === 0) return [];
	const n = arrays[0]?.length ?? 0;
	const result = new Array(n).fill(0);
	for (const arr of arrays) {
		for (let i = 0; i < n; i++) result[i] += arr[i] || 0;
	}
	return result;
}

export const streetStats = async (c: any) => {
	try {
		const { street_code, limit_violations } = c.req.valid("query");
		const sc = street_code;
		const violationLimit = limit_violations ?? 0;

		const SRC = "tv_mvs.violations_joined mv";
		const W = `mv.street_code = ${sc}`;
		const SPA = "tv_mvs.mv_spatial";
		const CAT = "tv_mvs.mv_street_category_temporal";
		const AGT = "tv_mvs.mv_street_agent_temporal";

		// ================================================================
		// Batch 1: lightweight metadata (2 queries)
		// ================================================================
		const [totalRes, periodRes] = await Promise.all([
			q(`SELECT COUNT(*)::int as total FROM ${SRC} WHERE ${W}`),
			q(
				`SELECT MIN(EXTRACT(YEAR FROM mv.violation_date))::text as ps, MAX(EXTRACT(YEAR FROM mv.violation_date))::text as pe FROM ${SRC} WHERE ${W}`,
			),
		]);

		const total = Number(totalRes.rows[0]?.total || 0);
		if (total === 0) {
			return c.json(
				{
					total_violations: 0,
					period_start: null,
					period_end: null,
					street_info: null,
					evolution: { by_year: [], by_month: [], by_weekday: [], by_hour: [] },
					category: [],
					violations: [],
					agents: [],
				},
				200,
			);
		}

		// ================================================================
		// Batch 2: top-level evolution + category temporal (3 queries)
		// ================================================================
		const [yearlyRes, monthlyRes, catTemporalRes] = await Promise.all([
			q(
				`SELECT year, SUM(count)::int as count FROM ${SPA} WHERE street_code = ${sc} GROUP BY year ORDER BY year`,
			),
			q(
				`SELECT year, month, SUM(count)::int as count FROM ${SPA} WHERE street_code = ${sc} GROUP BY year, month ORDER BY year, month`,
			),
			q(
				`SELECT * FROM ${CAT} WHERE street_code = ${sc} ORDER BY year, category`,
			),
		]);

		// Aggregate weekday/hour across categories for top-level evolution
		const catRows = catTemporalRes.rows as any[];
		const topWdMap = new Map<number, number[][]>();
		const topHrMap = new Map<number, number[][]>();
		for (const r of catRows) {
			const yr = Number(r.year);
			if (!topWdMap.has(yr)) {
				topWdMap.set(yr, []);
				topHrMap.set(yr, []);
			}
			topWdMap.get(yr)!.push((r.by_weekday || []).map(Number));
			topHrMap.get(yr)!.push((r.by_hour || []).map(Number));
		}
		const by_weekday = Array.from(topWdMap.entries())
			.sort(([a], [b]) => a - b)
			.map(([year, arrays]) => ({ year, counts: sumArrays(arrays) }));
		const by_hour = Array.from(topHrMap.entries())
			.sort(([a], [b]) => a - b)
			.map(([year, arrays]) => ({ year, counts: sumArrays(arrays) }));

		// ================================================================
		// Batch 3: agent temporal + category monthly (2 queries, MV reads)
		// ================================================================
		const [agentTemporalRes, catMonthlyRes] = await Promise.all([
			q(
				`SELECT * FROM ${AGT} WHERE street_code = ${sc} ORDER BY year, agent_id`,
			),
			q(
				`SELECT category, year, month, SUM(count)::int as count FROM ${SPA} WHERE street_code = ${sc} GROUP BY category, year, month ORDER BY category, year, month`,
			),
		]);

		// ================================================================
		// Batch 4: agent monthly + category top violations (2 queries, violations_joined)
		// ================================================================
		const [agentMonthlyRes, catViolRes] = await Promise.all([
			q(
				`SELECT mv.agent_id, EXTRACT(YEAR FROM mv.violation_date)::int as year, EXTRACT(MONTH FROM mv.violation_date)::int as month, COUNT(*)::int as count FROM ${SRC} WHERE ${W} GROUP BY mv.agent_id, EXTRACT(YEAR FROM mv.violation_date)::int, EXTRACT(MONTH FROM mv.violation_date)::int ORDER BY mv.agent_id, year, month`,
			),
			q(
				`SELECT * FROM (SELECT mv.category, mv.law_code, MAX(mv.canonical_description) as description, COUNT(*)::int as count, ROW_NUMBER() OVER (PARTITION BY mv.category ORDER BY COUNT(*) DESC) as rn FROM ${SRC} WHERE ${W} GROUP BY mv.category, mv.law_code) sub WHERE rn <= 5`,
			),
		]);

		// ================================================================
		// Batch 5: violations + violations yearly (2 queries)
		// ================================================================
		const [violRes, violYearlyRes] = await Promise.all([
			q(
				`SELECT mv.law_code, MAX(mv.canonical_description) as description, COUNT(*)::int as count FROM ${SRC} WHERE ${W} GROUP BY mv.law_code ORDER BY 3 DESC`,
			),
			q(
				`SELECT mv.law_code, EXTRACT(YEAR FROM mv.violation_date)::int as year, COUNT(*)::int as count FROM ${SRC} WHERE ${W} GROUP BY mv.law_code, EXTRACT(YEAR FROM mv.violation_date)::int ORDER BY mv.law_code, year`,
			),
		]);

		// ================================================================
		// Batch 5: street lookups (2 queries)
		// ================================================================
		const [streetNameRes, streetKmRes] = await Promise.all([
			db
				.select({ official_name: officialStreets.official_name })
				.from(officialStreets)
				.where(sql`${officialStreets.code} = ${sc}`)
				.limit(1),
			db
				.select({
					total_km: sql<number>`SUM(${pcrStreets.db2gse_sde}) / 1000.0`,
				})
				.from(pcrStreets)
				.where(sql`${pcrStreets.clogra_codi} = ${sc}`),
		]);

		// ================================================================
		// Build response
		// ================================================================
		const pr = periodRes.rows[0] || {};

		const by_year = yearlyRes.rows.map((r: any) => ({
			year: Number(r.year),
			count: Number(r.count),
		}));
		const by_month = monthlyRes.rows.map((r: any) => ({
			year: Number(r.year),
			month: Number(r.month),
			count: Number(r.count),
		}));

		// --- Category breakdown ---
		const catTotalMap = new Map<string, number>();
		const catYearMap = new Map<string, Map<number, number>>();
		const catWdMap = new Map<string, Map<number, number[]>>();
		const catHrMap = new Map<string, Map<number, number[]>>();

		for (const r of catRows) {
			const cat = r.category as string;
			const yr = Number(r.year);
			const cnt = Number(r.total_count);
			catTotalMap.set(cat, (catTotalMap.get(cat) || 0) + cnt);
			if (!catYearMap.has(cat)) catYearMap.set(cat, new Map());
			catYearMap.get(cat)!.set(yr, cnt);
			if (!catWdMap.has(cat)) catWdMap.set(cat, new Map());
			catWdMap.get(cat)!.set(yr, (r.by_weekday || []).map(Number));
			if (!catHrMap.has(cat)) catHrMap.set(cat, new Map());
			catHrMap.get(cat)!.set(yr, (r.by_hour || []).map(Number));
		}

		const catMonthMap = new Map<string, Map<number, Map<number, number>>>();
		for (const r of catMonthlyRes.rows as any[]) {
			const cat = r.category as string;
			const yr = Number(r.year);
			const mo = Number(r.month);
			const cnt = Number(r.count);
			if (!catMonthMap.has(cat)) catMonthMap.set(cat, new Map());
			if (!catMonthMap.get(cat)!.has(yr))
				catMonthMap.get(cat)!.set(yr, new Map());
			catMonthMap.get(cat)!.get(yr)!.set(mo, cnt);
		}

		const catTopViolMap = new Map<string, any[]>();
		for (const r of catViolRes.rows as any[]) {
			const cat = r.category as string;
			if (!catTopViolMap.has(cat)) catTopViolMap.set(cat, []);
			catTopViolMap.get(cat)!.push({
				law_code: r.law_code,
				description: r.description,
				count: Number(r.count),
			});
		}

		const agentRows = agentTemporalRes.rows as any[];
		const category = Array.from(catTotalMap.entries())
			.sort(([, a], [, b]) => b - a)
			.map(([cat, catTotal]) => ({
				category: cat,
				count: catTotal,
				percentage: Math.round((catTotal / total) * 1000) / 10,
				by_year: Array.from((catYearMap.get(cat) || new Map()).entries())
					.sort(([a], [b]) => a - b)
					.map(([year, count]) => ({ year, count })),
				by_month: Array.from((catMonthMap.get(cat) || new Map()).entries())
					.sort(([a], [b]) => a - b)
					.flatMap(([year, monthMap]) =>
						(Array.from(monthMap.entries()) as [number, number][])
							.sort(([a], [b]) => a - b)
							.map(([month, count]) => ({ year, month, count })),
					),
				by_weekday: Array.from((catWdMap.get(cat) || new Map()).entries())
					.sort(([a], [b]) => a - b)
					.map(([year, counts]) => ({ year, counts })),
				by_hour: Array.from((catHrMap.get(cat) || new Map()).entries())
					.sort(([a], [b]) => a - b)
					.map(([year, counts]) => ({ year, counts })),
				top_violations: catTopViolMap.get(cat) || [],
			}));

		// --- Agent breakdown ---
		const agentTotalMap = new Map<number, number>();
		const agentYearMap = new Map<number, Map<number, number>>();
		const agentWdMap = new Map<number, Map<number, number[]>>();
		const agentHrMap = new Map<number, Map<number, number[]>>();

		for (const r of agentRows) {
			const aid = Number(r.agent_id);
			const yr = Number(r.year);
			const cnt = Number(r.total_count);
			agentTotalMap.set(aid, (agentTotalMap.get(aid) || 0) + cnt);
			if (!agentYearMap.has(aid)) agentYearMap.set(aid, new Map());
			agentYearMap.get(aid)!.set(yr, cnt);
			if (!agentWdMap.has(aid)) agentWdMap.set(aid, new Map());
			agentWdMap.get(aid)!.set(yr, (r.by_weekday || []).map(Number));
			if (!agentHrMap.has(aid)) agentHrMap.set(aid, new Map());
			agentHrMap.get(aid)!.set(yr, (r.by_hour || []).map(Number));
		}

		const agentMonthMap = new Map<number, Map<number, Map<number, number>>>();
		for (const r of agentMonthlyRes.rows as any[]) {
			const aid = Number(r.agent_id);
			const yr = Number(r.year);
			const mo = Number(r.month);
			const cnt = Number(r.count);
			if (!agentMonthMap.has(aid)) agentMonthMap.set(aid, new Map());
			if (!agentMonthMap.get(aid)!.has(yr))
				agentMonthMap.get(aid)!.set(yr, new Map());
			agentMonthMap.get(aid)!.get(yr)!.set(mo, cnt);
		}

		const agents = Array.from(agentTotalMap.entries())
			.sort(([, a], [, b]) => b - a)
			.map(([aid, agTotal]) => {
				const info = AGENT_INFO[aid] ?? {
					description: `Agente ${aid}`,
					category: "manual" as const,
				};
				return {
					agent_id: aid,
					description: info.description,
					count: agTotal,
					percentage: Math.round((agTotal / total) * 1000) / 10,
					category: info.category,
					by_year: Array.from((agentYearMap.get(aid) || new Map()).entries())
						.sort(([a], [b]) => a - b)
						.map(([year, count]) => ({ year, count })),
					by_month: Array.from((agentMonthMap.get(aid) || new Map()).entries())
						.sort(([a], [b]) => a - b)
						.flatMap(([year, monthMap]) =>
							(Array.from(monthMap.entries()) as [number, number][])
								.sort(([a], [b]) => a - b)
								.map(([month, count]) => ({ year, month, count })),
						),
					by_weekday: Array.from((agentWdMap.get(aid) || new Map()).entries())
						.sort(([a], [b]) => a - b)
						.map(([year, counts]) => ({ year, counts })),
					by_hour: Array.from((agentHrMap.get(aid) || new Map()).entries())
						.sort(([a], [b]) => a - b)
						.map(([year, counts]) => ({ year, counts })),
				};
			});

		// --- Violations ---
		const violByYearMap = new Map<string, Map<number, number>>();
		for (const r of violYearlyRes.rows as any[]) {
			const lc = r.law_code as string;
			if (!violByYearMap.has(lc)) violByYearMap.set(lc, new Map());
			violByYearMap.get(lc)!.set(Number(r.year), Number(r.count));
		}

		const allViolations = violRes.rows.map((r: any) => {
			const lc = r.law_code as string;
			const cnt = Number(r.count);
			const yMap = violByYearMap.get(lc) || new Map();
			return {
				law_code: lc,
				description: r.description as string,
				count: cnt,
				percentage: Math.round((cnt / total) * 1000) / 10,
				by_year: Array.from(yMap.entries())
					.sort(([a], [b]) => a - b)
					.map(([year, count]) => ({ year, count })),
			};
		});
		const violations =
			violationLimit > 0
				? allViolations.slice(0, violationLimit)
				: allViolations;

		// --- Street info ---
		const officialName = streetNameRes[0]?.official_name || null;
		const extensionKm = Number(streetKmRes[0]?.total_km) || 0;
		const street_info = officialName
			? {
					street_code: sc,
					official_name: officialName,
					extension_km: Math.round(extensionKm * 100) / 100,
					violations_per_km:
						extensionKm > 0 ? Math.round((total / extensionKm) * 100) / 100 : 0,
				}
			: null;

		return c.json(
			{
				total_violations: total,
				period_start: pr.ps ? `${pr.ps}-01-01` : null,
				period_end: pr.pe ? `${pr.pe}-12-31` : null,
				street_info,
				evolution: { by_year, by_month, by_weekday, by_hour },
				category,
				violations,
				agents,
			},
			200,
		);
	} catch (error) {
		console.error("Error fetching street stats:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};
