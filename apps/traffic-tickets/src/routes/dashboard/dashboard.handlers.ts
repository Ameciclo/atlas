import { count, sql, sum, desc, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import { officialStreets } from "../../db/schema.js";
import { AGENT_INFO } from "../../lib/query-helpers.js";
import { overviewFiltered } from "./overview-filtered.js";
import {
	violationsJoinedView,
	mvTemporalView,
	agentTopViolationsView,
	agentTopViolationsYearlyView,
	categoryTopViolationsYearlyView,
} from "../../db/views.js";

// ============================================================================
// 1. Overview
// ============================================================================

export const overview = async (c: any) => {
	const { category, law, street_code, top_violations_limit } =
		c.req.valid("query");
	const tvLimit = top_violations_limit ?? 5;
	if (category)
		return await overviewFiltered(
			c,
			`mv.category = '${(category as string).replace(/'/g, "''")}'`,
			false,
			false,
			tvLimit,
		);
	if (law) {
		const normalized = (law as string)
			.toLowerCase()
			.replace(/\s+/g, "")
			.replace(/'/g, "''");
		return await overviewFiltered(
			c,
			`LOWER(REGEXP_REPLACE(mv.law_code, '\\s+', '', 'g')) LIKE '${normalized}%'`,
			true,
			false,
			tvLimit,
		);
	}
	if (street_code)
		return await overviewFiltered(
			c,
			`mv.street_code = ${street_code}`,
			false,
			true,
			tvLimit,
			street_code,
		);

	try {
		const [
			statsResult,
			streetsResult,
			agentResult,
			yearlyResult,
			monthlyResult,
			weekdayResult,
			hourlyResult,
			categoryResult,
			agentTopViolResult,
			agentsByYearResult,
			catsByYearResult,
			agentTopByYearResult,
			catTopByYearResult,
			categoryLawCodesResult,
			catMonthlyResult,
			catWeekdayResult,
			catHourlyResult,
		] = await Promise.all([
			db.execute(
				sql`SELECT COALESCE(SUM(count),0)::int as total_violations, COUNT(DISTINCT violation_id)::int as violation_types_count, COUNT(DISTINCT violation_id)::int as law_codes_count FROM ${mvTemporalView}`,
			),
			db.select({ count: count() }).from(officialStreets),
			db.execute(
				sql`SELECT ${violationsJoinedView.agentId} as agent_id, COUNT(*)::int as count FROM ${violationsJoinedView} GROUP BY ${violationsJoinedView.agentId} ORDER BY count DESC`,
			),
			db.execute(
				sql`SELECT ${mvTemporalView.year}, SUM(${mvTemporalView.count})::int as count FROM ${mvTemporalView} GROUP BY ${mvTemporalView.year} ORDER BY ${mvTemporalView.year}`,
			),
			db.execute(
				sql`SELECT ${mvTemporalView.year}, ${mvTemporalView.month}, SUM(${mvTemporalView.count})::int as count FROM ${mvTemporalView} GROUP BY ${mvTemporalView.year}, ${mvTemporalView.month} ORDER BY ${mvTemporalView.year}, ${mvTemporalView.month}`,
			),
			db.execute(sql`
				SELECT years.y as year, array_agg(COALESCE(cnt, 0) ORDER BY g.wd) as counts
				FROM generate_series(0,6) as g(wd)
				CROSS JOIN (SELECT DISTINCT ${mvTemporalView.year} as y FROM ${mvTemporalView}) years
				LEFT JOIN (
					SELECT ${mvTemporalView.year} as y, ${mvTemporalView.weekday} as d, SUM(${mvTemporalView.count})::int as cnt
					FROM ${mvTemporalView} GROUP BY ${mvTemporalView.year}, ${mvTemporalView.weekday}
				) data ON ${sql.raw("years.y = data.y AND g.wd = data.d")}
				GROUP BY years.y ORDER BY years.y
			`),
			db.execute(sql`
				SELECT years.y as year, array_agg(COALESCE(cnt, 0) ORDER BY g.hr) as counts
				FROM generate_series(0,23) as g(hr)
				CROSS JOIN (SELECT DISTINCT ${mvTemporalView.year} as y FROM ${mvTemporalView}) years
				LEFT JOIN (
					SELECT ${mvTemporalView.year} as y, ${mvTemporalView.hour} as h, SUM(${mvTemporalView.count})::int as cnt
					FROM ${mvTemporalView} GROUP BY ${mvTemporalView.year}, ${mvTemporalView.hour}
				) data ON ${sql.raw("years.y = data.y AND g.hr = data.h")}
				GROUP BY years.y ORDER BY years.y
			`),
			db.execute(sql`
				WITH ranked AS (
					SELECT c.category, c.law_code, c.canonical_description as description, SUM(cube.count)::int as count,
						ROW_NUMBER() OVER (PARTITION BY c.category ORDER BY SUM(cube.count) DESC) as rn
					FROM traffic_tickets_catalog c
					JOIN ${mvTemporalView} cube ON cube.violation_id = c.id
					WHERE c.category IS NOT NULL
					GROUP BY c.category, c.law_code, c.canonical_description
				)
				SELECT category, jsonb_agg(jsonb_build_object(
					'law_code', law_code, 'description', description, 'count', count
				) ORDER BY count DESC) as top_violations
				FROM ranked WHERE rn <= ${tvLimit} GROUP BY category
			`),
			db
				.select({
					agentId: agentTopViolationsView.agentId,
					lawCode: agentTopViolationsView.lawCode,
					description: agentTopViolationsView.description,
					count: agentTopViolationsView.count,
				})
				.from(agentTopViolationsView),
			db.execute(
				sql`SELECT ${violationsJoinedView.year}, ${violationsJoinedView.agentId}, COUNT(*)::int as count FROM ${violationsJoinedView} GROUP BY ${violationsJoinedView.year}, ${violationsJoinedView.agentId} ORDER BY ${violationsJoinedView.year}, ${violationsJoinedView.agentId}`,
			),
			db.execute(
				sql`SELECT ${mvTemporalView.year}, ${mvTemporalView.category}, SUM(${mvTemporalView.count})::int as count FROM ${mvTemporalView} WHERE ${mvTemporalView.category} IS NOT NULL GROUP BY ${mvTemporalView.year}, ${mvTemporalView.category} ORDER BY ${mvTemporalView.year}, ${mvTemporalView.category}`,
			),
			db
				.select({
					agentId: agentTopViolationsYearlyView.agentId,
					year: agentTopViolationsYearlyView.year,
					lawCode: agentTopViolationsYearlyView.lawCode,
					description: agentTopViolationsYearlyView.description,
					count: agentTopViolationsYearlyView.count,
				})
				.from(agentTopViolationsYearlyView)
				.orderBy(
					agentTopViolationsYearlyView.agentId,
					agentTopViolationsYearlyView.year,
					desc(agentTopViolationsYearlyView.count),
				),
			db
				.select({
					category: categoryTopViolationsYearlyView.category,
					year: categoryTopViolationsYearlyView.year,
					lawCode: categoryTopViolationsYearlyView.lawCode,
					description: categoryTopViolationsYearlyView.description,
					count: categoryTopViolationsYearlyView.count,
				})
				.from(categoryTopViolationsYearlyView)
				.orderBy(
					categoryTopViolationsYearlyView.category,
					categoryTopViolationsYearlyView.year,
					desc(categoryTopViolationsYearlyView.count),
				),
			db.execute(
				sql`SELECT ${mvTemporalView.category}, COUNT(DISTINCT ${mvTemporalView.violationId})::int as cnt FROM ${mvTemporalView} WHERE ${mvTemporalView.category} IS NOT NULL GROUP BY ${mvTemporalView.category}`,
			),
			db.execute(
				sql`SELECT ${mvTemporalView.year}, ${mvTemporalView.month}, ${mvTemporalView.category}, SUM(${mvTemporalView.count})::int as count FROM ${mvTemporalView} WHERE ${mvTemporalView.category} IS NOT NULL GROUP BY ${mvTemporalView.year}, ${mvTemporalView.month}, ${mvTemporalView.category} ORDER BY ${mvTemporalView.year}, ${mvTemporalView.month}, ${mvTemporalView.category}`,
			),
			db.execute(sql`
				SELECT yc.y as year, yc.cat as category, array_agg(COALESCE(cnt, 0) ORDER BY g.d) as counts
				FROM generate_series(0,6) as g(d)
				CROSS JOIN (
					SELECT DISTINCT ${mvTemporalView.year} as y, ${mvTemporalView.category} as cat
					FROM ${mvTemporalView} WHERE ${mvTemporalView.category} IS NOT NULL
				) yc
				LEFT JOIN (
					SELECT ${mvTemporalView.year} as y, ${mvTemporalView.weekday} as d, ${mvTemporalView.category} as cat, SUM(${mvTemporalView.count})::int as cnt
					FROM ${mvTemporalView} WHERE ${mvTemporalView.category} IS NOT NULL
					GROUP BY ${mvTemporalView.year}, ${mvTemporalView.weekday}, ${mvTemporalView.category}
				) data ON ${sql.raw("yc.y = data.y AND yc.cat = data.cat AND g.d = data.d")}
				GROUP BY yc.y, yc.cat ORDER BY yc.y, yc.cat
			`),
			db.execute(sql`
				SELECT yc.y as year, yc.cat as category, array_agg(COALESCE(cnt, 0) ORDER BY g.hr) as counts
				FROM generate_series(0,23) as g(hr)
				CROSS JOIN (
					SELECT DISTINCT ${mvTemporalView.year} as y, ${mvTemporalView.category} as cat
					FROM ${mvTemporalView} WHERE ${mvTemporalView.category} IS NOT NULL
				) yc
				LEFT JOIN (
					SELECT ${mvTemporalView.year} as y, ${mvTemporalView.hour} as h, ${mvTemporalView.category} as cat, SUM(${mvTemporalView.count})::int as cnt
					FROM ${mvTemporalView} WHERE ${mvTemporalView.category} IS NOT NULL
					GROUP BY ${mvTemporalView.year}, ${mvTemporalView.hour}, ${mvTemporalView.category}
				) data ON ${sql.raw("yc.y = data.y AND yc.cat = data.cat AND g.hr = data.h")}
				GROUP BY yc.y, yc.cat ORDER BY yc.y, yc.cat
			`),
		]);

		const statsRow = (statsResult.rows[0] || {}) as any;
		const total = statsRow?.total_violations || 0;
		const agentRows = agentResult.rows as any[];
		const years = (yearlyResult.rows as any[]).map((r: any) => Number(r.year));
		const periodStart = years.length > 0 ? `${Math.min(...years)}-01-01` : null;
		const periodEnd = years.length > 0 ? `${Math.max(...years)}-12-31` : null;

		// Agent top_violations map
		const agentTopMap = new Map<number, any[]>();
		for (const r of agentTopViolResult as any[]) {
			const key = r.agentId;
			if (!agentTopMap.has(key)) agentTopMap.set(key, []);
			agentTopMap
				.get(key)!
				.push({
					law_code: r.lawCode,
					description: r.description,
					count: Number(r.count),
				});
		}

		// Category totals
		const catTotals = new Map<string, number>();
		for (const r of categoryResult.rows as any[]) {
			catTotals.set(
				r.category,
				r.top_violations
					? (r.top_violations as any[]).reduce(
							(s: number, v: any) => s + Number(v.count),
							0,
						)
					: 0,
			);
		}

		// Distinct law codes per category
		const lawCodesByCategory = new Map<string, number>();
		for (const r of categoryLawCodesResult.rows as any[]) {
			lawCodesByCategory.set(r.category, Number(r.cnt));
		}

		const evolution = {
			by_year: (yearlyResult.rows as any[]).map((y: any) => ({
				year: Number(y.year),
				count: Number(y.count),
			})),
			by_month: (monthlyResult.rows as any[]).map((m: any) => ({
				year: Number(m.year),
				month: Number(m.month),
				count: Number(m.count),
			})),
			by_weekday: (weekdayResult.rows as any[]).map((w: any) => ({
				year: Number(w.year),
				counts: (w.counts || []).map(Number),
			})),
			by_hour: (hourlyResult.rows as any[]).map((h: any) => ({
				year: Number(h.year),
				counts: (h.counts || []).map(Number),
			})),
		};

		// Agent top violations by year map
		const agentTopByYearMap = new Map<string, any[]>();
		for (const r of agentTopByYearResult as any[]) {
			const key = `${r.year}-${r.agentId}`;
			if (!agentTopByYearMap.has(key)) agentTopByYearMap.set(key, []);
			agentTopByYearMap
				.get(key)!
				.push({
					law_code: r.lawCode,
					description: r.description,
					count: Number(r.count),
				});
		}

		// Category top violations by year map
		const catTopByYearMap = new Map<string, any[]>();
		for (const r of catTopByYearResult as any[]) {
			const key = `${r.year}-${r.category}`;
			if (!catTopByYearMap.has(key)) catTopByYearMap.set(key, []);
			catTopByYearMap
				.get(key)!
				.push({
					law_code: r.lawCode,
					description: r.description,
					count: Number(r.count),
				});
		}

		// Agents by year
		const agentsByYearMap = new Map<number, Map<number, number>>();
		for (const r of agentsByYearResult.rows as any[]) {
			const yr = Number(r.year),
				aid = Number(r.agent_id),
				cnt = Number(r.count);
			if (!agentsByYearMap.has(yr)) agentsByYearMap.set(yr, new Map());
			agentsByYearMap.get(yr)!.set(aid, cnt);
		}

		// Categories by year
		const catsByYearMap = new Map<number, Map<string, number>>();
		for (const r of catsByYearResult.rows as any[]) {
			const yr = Number(r.year),
				cat = r.category as string,
				cnt = Number(r.count);
			if (!catsByYearMap.has(yr)) catsByYearMap.set(yr, new Map());
			catsByYearMap.get(yr)!.set(cat, cnt);
		}

		// Categories by month
		const catsByMonthMap = new Map<string, Map<number, Map<number, number>>>();
		for (const r of catMonthlyResult.rows as any[]) {
			const cat = r.category as string,
				yr = Number(r.year),
				mo = Number(r.month),
				cnt = Number(r.count);
			if (!catsByMonthMap.has(cat)) catsByMonthMap.set(cat, new Map());
			const ym = catsByMonthMap.get(cat)!;
			if (!ym.has(yr)) ym.set(yr, new Map());
			ym.get(yr)!.set(mo, cnt);
		}

		// Categories by weekday
		const catsByWeekdayMap = new Map<string, Map<number, number[]>>();
		for (const r of catWeekdayResult.rows as any[]) {
			const cat = r.category as string,
				yr = Number(r.year),
				counts = (r.counts || []).map(Number);
			if (!catsByWeekdayMap.has(cat)) catsByWeekdayMap.set(cat, new Map());
			catsByWeekdayMap.get(cat)!.set(yr, counts);
		}

		// Categories by hour
		const catsByHourlyMap = new Map<string, Map<number, number[]>>();
		for (const r of catHourlyResult.rows as any[]) {
			const cat = r.category as string,
				yr = Number(r.year),
				counts = (r.counts || []).map(Number);
			if (!catsByHourlyMap.has(cat)) catsByHourlyMap.set(cat, new Map());
			catsByHourlyMap.get(cat)!.set(yr, counts);
		}

		const agents = agentRows.map((a: any) => {
			const info = AGENT_INFO[a.agent_id] ?? {
				description: `Agente ${a.agent_id}`,
				category: "manual" as const,
			};
			const by_year = Array.from(agentsByYearMap.entries())
				.sort(([ya], [yb]) => ya - yb)
				.map(([year, agentMap]) => {
					const yearTotal = Array.from(agentMap.values()).reduce(
						(s, c) => s + c,
						0,
					);
					const count = agentMap.get(a.agent_id) || 0;
					return {
						year,
						count,
						percentage:
							yearTotal > 0 ? Math.round((count / yearTotal) * 1000) / 10 : 0,
						top_violations: (
							agentTopByYearMap.get(`${year}-${a.agent_id}`) || []
						)
							.slice(0, tvLimit)
							.map((v: any) => ({
								law_code: v.law_code,
								description: v.description,
								count: Number(v.count),
							})),
					};
				});
			return {
				agent_id: a.agent_id,
				description: info.description,
				count: a.count,
				percentage: total > 0 ? Math.round((a.count / total) * 1000) / 10 : 0,
				category: info.category,
				top_violations: (agentTopMap.get(a.agent_id) || [])
					.slice(0, tvLimit)
					.map((v: any) => ({
						law_code: v.law_code,
						description: v.description,
						count: Number(v.count),
					})),
				by_year,
			};
		});

		const category = (categoryResult.rows as any[])
			.map((c: any) => {
				const catTotal = catTotals.get(c.category) || 0;
				const by_year = Array.from(catsByYearMap.entries())
					.sort(([ya], [yb]) => ya - yb)
					.map(([year, catMap]) => {
						const yearTotal = Array.from(catMap.values()).reduce(
							(s, n) => s + n,
							0,
						);
						const count = catMap.get(c.category) || 0;
						return {
							year,
							count,
							percentage:
								yearTotal > 0 ? Math.round((count / yearTotal) * 1000) / 10 : 0,
							top_violations: (
								catTopByYearMap.get(`${year}-${c.category}`) || []
							)
								.slice(0, tvLimit)
								.map((v: any) => ({
									law_code: v.law_code,
									description: v.description,
									count: Number(v.count),
								})),
						};
					});
				const catMonthMap = catsByMonthMap.get(c.category);
				const by_month = catMonthMap
					? Array.from(catMonthMap.entries())
							.sort(([ya], [yb]) => ya - yb)
							.flatMap(([year, mm]) =>
								Array.from(mm.entries())
									.sort(([ma], [mb]) => ma - mb)
									.map(([month, cnt]) => ({ year, month, count: cnt })),
							)
					: [];
				const catWeekdayMap = catsByWeekdayMap.get(c.category);
				const by_weekday = catWeekdayMap
					? Array.from(catWeekdayMap.entries())
							.sort(([ya], [yb]) => ya - yb)
							.map(([year, counts]) => ({ year, counts }))
					: [];
				const catHourlyMap = catsByHourlyMap.get(c.category);
				const by_hour = catHourlyMap
					? Array.from(catHourlyMap.entries())
							.sort(([ya], [yb]) => ya - yb)
							.map(([year, counts]) => ({ year, counts }))
					: [];
				return {
					category: c.category,
					count: catTotal,
					percentage:
						total > 0 ? Math.round((catTotal / total) * 1000) / 10 : 0,
					law_codes_count: lawCodesByCategory.get(c.category) || 0,
					top_violations: (c.top_violations || []).map((v: any) => ({
						law_code: v.law_code,
						description: v.description,
						count: Number(v.count),
					})),
					by_year,
					by_month,
					by_weekday,
					by_hour,
				};
			})
			.sort((a: any, b: any) => b.count - a.count);

		return c.json(
			{
				total_violations: total,
				period_start: periodStart,
				period_end: periodEnd,
				violation_types_count: statsRow?.violation_types_count || 0,
				law_codes_count: statsRow?.law_codes_count || 0,
				streets_count: streetsResult?.[0]?.count || 0,
				evolution,
				category,
				agents,
			},
			200,
		);
	} catch (error) {
		console.error("Error fetching overview:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};
// ============================================================================
// 2. Violation Codes
// ============================================================================

export const violationCodes = async (c: any) => {
	const { start_date, end_date, category, street_code, include_by_year } =
		c.req.valid("query");
	const hasFilters = start_date || end_date || street_code;

	try {
		const conditions: string[] = [];
		if (street_code) conditions.push(`tv.street_code = ${street_code}`);

		if (!hasFilters) {
			const catalogConditions: string[] = [];
			if (category)
				catalogConditions.push(
					`tvc.category = '${(category as string).replace(/'/g, "''")}'`,
				);
			const catalogWhereSQL =
				catalogConditions.length > 0
					? `WHERE ${catalogConditions.join(" AND ")}`
					: "";

			const [rowsResult, yearlyResult] = await Promise.all([
				db.execute(sql`
					SELECT tvc.id, tvc.law_code, tvc.canonical_description as description, tvc.category,
						COALESCE(SUM(cube.count), 0)::int as count
					FROM traffic_tickets_catalog tvc
					LEFT JOIN ${mvTemporalView} cube ON cube.violation_id = tvc.id
					${sql.raw(catalogWhereSQL ? `${catalogWhereSQL}` : "")}
					GROUP BY tvc.id, tvc.law_code, tvc.canonical_description, tvc.category
					ORDER BY count DESC
				`),
				include_by_year
					? db.execute(sql`
						SELECT tvc.law_code, cube.year::int as year, SUM(cube.count)::int as count
						FROM ${mvTemporalView} cube
						JOIN traffic_tickets_catalog tvc ON cube.violation_id = tvc.id
						${sql.raw(catalogWhereSQL ? `${catalogWhereSQL}` : "")}
						GROUP BY tvc.law_code, cube.year
						ORDER BY tvc.law_code, cube.year
					`)
					: Promise.resolve(null),
			]);

			const rows = rowsResult.rows as any[];
			const byYearMap = new Map<string, Record<string, number>>();
			if (yearlyResult) {
				for (const r of yearlyResult.rows as any[]) {
					const entry = byYearMap.get(r.law_code) || {};
					entry[String(r.year)] = Number(r.count);
					byYearMap.set(r.law_code, entry);
				}
			}
			return c.json(
				{
					codes: rows.map((v: any) => ({
						law_code: v.law_code,
						description: v.description,
						category: v.category,
						count: Number(v.count),
						...(include_by_year
							? { by_year: byYearMap.get(v.law_code) || {} }
							: {}),
					})),
				},
				200,
			);
		}

		if (start_date) conditions.push(`tv.violation_date >= '${start_date}'`);
		if (end_date) conditions.push(`tv.violation_date <= '${end_date}'`);
		if (category)
			conditions.push(
				`tv.category = '${(category as string).replace(/'/g, "''")}'`,
			);
		const whereSQL =
			conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

		if (include_by_year) {
			const data = await db.execute(sql`
				SELECT ${violationsJoinedView.lawCode}, ${violationsJoinedView.canonicalDescription} as description, ${violationsJoinedView.category},
					EXTRACT(YEAR FROM ${violationsJoinedView.violationDate})::int as year, COUNT(*)::int as count
				FROM ${violationsJoinedView} tv
				${sql.raw(whereSQL ? `${whereSQL}` : "")}
				GROUP BY tv.law_code, tv.canonical_description, tv.category, EXTRACT(YEAR FROM tv.violation_date)
				ORDER BY tv.law_code, year
			`);
			const codeMap = new Map<string, any>();
			for (const r of data.rows as any[]) {
				const code = r.law_code;
				if (!codeMap.has(code))
					codeMap.set(code, {
						law_code: r.law_code,
						description: r.description,
						category: r.category,
						count: 0,
						by_year: {},
					});
				const e = codeMap.get(code);
				e.count += Number(r.count);
				e.by_year[String(r.year)] = Number(r.count);
			}
			return c.json(
				{
					codes: Array.from(codeMap.values()).sort((a, b) => b.count - a.count),
				},
				200,
			);
		}

		const data = await db.execute(sql`
			SELECT ${violationsJoinedView.lawCode}, ${violationsJoinedView.canonicalDescription} as description, ${violationsJoinedView.category}, COUNT(*)::int as count
			FROM ${violationsJoinedView} tv
			${sql.raw(whereSQL ? `${whereSQL}` : "")}
			GROUP BY ${violationsJoinedView.lawCode}, ${violationsJoinedView.canonicalDescription}, ${violationsJoinedView.category}
			ORDER BY count DESC
		`);
		return c.json(
			{
				codes: data.rows.map((v: any) => ({
					law_code: v.law_code,
					description: v.description,
					category: v.category,
					count: Number(v.count),
				})),
			},
			200,
		);
	} catch (error) {
		console.error("Error fetching violation codes:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};
