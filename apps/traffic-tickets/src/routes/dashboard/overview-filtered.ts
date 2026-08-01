import { sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { officialStreets } from "../../db/schema.js";
import { pcrStreets } from "../../db/schema.js";
import { AGENT_INFO } from "../../lib/query-helpers.js";

function q(sqlStr: string) {
	return db.execute(sql.raw(sqlStr));
}

export async function overviewFiltered(
	c: any,
	whereStr: string,
	includeLawCodes = false,
	includeStreetInfo = false,
	topViolationsLimit = 5,
	streetCode?: number,
) {
	const w = whereStr;
	const SRC = `tv_mvs.violations_joined mv`;
	const tvl = topViolationsLimit;

	const [
		totalRes,
		periodRes,
		typesRes,
		lawsRes,
		streetsRes,
		yearlyRes,
		monthlyRes,
		wdRes,
		hrRes,
		agRes,
		ayRes,
		catRes,
		cyRes,
		lcRes,
		catTvRes,
		agTvRes,
		ayTvRes,
		cyTvRes,
		catLcRes,
		cmRes,
		cwRes,
		chRes,
	] = await Promise.all([
		q(`SELECT COUNT(*)::int as cnt FROM ${SRC} WHERE ${w}`),
		q(
			`SELECT MIN(EXTRACT(YEAR FROM mv.violation_date))::text as ps, MAX(EXTRACT(YEAR FROM mv.violation_date))::text as pe FROM ${SRC} WHERE ${w}`,
		),
		q(`SELECT COUNT(DISTINCT mv.cttu_code)::int as cnt FROM ${SRC} WHERE ${w}`),
		q(`SELECT COUNT(DISTINCT mv.law_code)::int as cnt FROM ${SRC} WHERE ${w}`),
		q(
			`SELECT COUNT(DISTINCT mv.street_code)::int as cnt FROM ${SRC} WHERE ${w} AND mv.street_code IS NOT NULL`,
		),
		q(
			`SELECT EXTRACT(YEAR FROM mv.violation_date)::int as year, COUNT(*)::int as count FROM ${SRC} WHERE ${w} GROUP BY 1 ORDER BY 1`,
		),
		q(
			`SELECT EXTRACT(YEAR FROM mv.violation_date)::int as year, EXTRACT(MONTH FROM mv.violation_date)::int as month, COUNT(*)::int as count FROM ${SRC} WHERE ${w} GROUP BY 1,2 ORDER BY 1,2`,
		),
		q(
			`SELECT years.y as year, array_agg(COALESCE(cnt, 0) ORDER BY g.wd) as counts FROM generate_series(0,6) as g(wd) CROSS JOIN (SELECT DISTINCT EXTRACT(YEAR FROM mv.violation_date)::int as y FROM ${SRC} WHERE ${w}) years LEFT JOIN (SELECT EXTRACT(YEAR FROM mv.violation_date)::int as y, EXTRACT(DOW FROM mv.violation_date)::int as d, COUNT(*)::int as cnt FROM ${SRC} WHERE ${w} GROUP BY 1,2) data ON years.y = data.y AND g.wd = data.d GROUP BY 1 ORDER BY 1`,
		),
		q(
			`SELECT years.y as year, array_agg(COALESCE(cnt, 0) ORDER BY g.hr) as counts FROM generate_series(0,23) as g(hr) CROSS JOIN (SELECT DISTINCT EXTRACT(YEAR FROM mv.violation_date)::int as y FROM ${SRC} WHERE ${w}) years LEFT JOIN (SELECT EXTRACT(YEAR FROM mv.violation_date)::int as y, EXTRACT(HOUR FROM mv.violation_date)::int as h, COUNT(*)::int as cnt FROM ${SRC} WHERE ${w} GROUP BY 1,2) data ON years.y = data.y AND g.hr = data.h GROUP BY 1 ORDER BY 1`,
		),
		q(
			`SELECT mv.agent_id, COUNT(*)::int as count FROM ${SRC} WHERE ${w} GROUP BY 1 ORDER BY 2 DESC`,
		),
		q(
			`SELECT EXTRACT(YEAR FROM mv.violation_date)::int as year, mv.agent_id, COUNT(*)::int as count FROM ${SRC} WHERE ${w} GROUP BY 1,2`,
		),
		q(
			`SELECT mv.category, COUNT(*)::int as count FROM ${SRC} WHERE ${w} GROUP BY 1 ORDER BY 2 DESC`,
		),
		q(
			`SELECT EXTRACT(YEAR FROM mv.violation_date)::int as year, mv.category, COUNT(*)::int as count FROM ${SRC} WHERE ${w} GROUP BY 1,2`,
		),
		q(
			`SELECT mv.law_code, MAX(mv.canonical_description) as description, COUNT(*)::int as count FROM ${SRC} WHERE ${w} GROUP BY 1 ORDER BY 3 DESC`,
		),
		// Top violations per category
		q(
			`SELECT category, jsonb_agg(tv ORDER BY (tv->>'count')::int DESC) as top_violations FROM (SELECT mv.category, jsonb_build_object('law_code', mv.law_code, 'description', MAX(mv.canonical_description), 'count', COUNT(*)::int) as tv, ROW_NUMBER() OVER (PARTITION BY mv.category ORDER BY COUNT(*) DESC) as rn FROM ${SRC} WHERE ${w} GROUP BY mv.category, mv.law_code) sub WHERE rn <= ${tvl} GROUP BY category`,
		),
		// Top violations per agent
		q(
			`SELECT agent_id, jsonb_agg(tv ORDER BY (tv->>'count')::int DESC) as top_violations FROM (SELECT mv.agent_id, jsonb_build_object('law_code', mv.law_code, 'description', MAX(mv.canonical_description), 'count', COUNT(*)::int) as tv, ROW_NUMBER() OVER (PARTITION BY mv.agent_id ORDER BY COUNT(*) DESC) as rn FROM ${SRC} WHERE ${w} GROUP BY mv.agent_id, mv.law_code) sub WHERE rn <= ${tvl} GROUP BY agent_id`,
		),
		// Top violations per agent per year
		q(
			`SELECT EXTRACT(YEAR FROM mv.violation_date)::int as year, mv.agent_id, jsonb_build_object('law_code', mv.law_code, 'description', MAX(mv.canonical_description), 'count', COUNT(*)::int) as tv, ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM mv.violation_date)::int, mv.agent_id ORDER BY COUNT(*) DESC) as rn FROM ${SRC} WHERE ${w} GROUP BY 1,2,mv.law_code ORDER BY year, agent_id, COUNT(*) DESC`,
		),
		// Top violations per category per year
		q(
			`SELECT EXTRACT(YEAR FROM mv.violation_date)::int as year, mv.category, jsonb_build_object('law_code', mv.law_code, 'description', MAX(mv.canonical_description), 'count', COUNT(*)::int) as tv, ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM mv.violation_date)::int, mv.category ORDER BY COUNT(*) DESC) as rn FROM ${SRC} WHERE ${w} GROUP BY 1,2,mv.law_code ORDER BY year, category, COUNT(*) DESC`,
		),
		// Distinct law codes per category
		q(
			`SELECT mv.category, COUNT(DISTINCT mv.law_code)::int as cnt FROM ${SRC} WHERE ${w} GROUP BY mv.category`,
		),
		// Category by month
		q(
			`SELECT EXTRACT(YEAR FROM mv.violation_date)::int as year, EXTRACT(MONTH FROM mv.violation_date)::int as month, mv.category, COUNT(*)::int as count FROM ${SRC} WHERE ${w} GROUP BY 1,2,3 ORDER BY 1,2,3`,
		),
		// Category by weekday
		q(
			`SELECT yc.y as year, yc.cat as category, array_agg(COALESCE(cnt, 0) ORDER BY g.d) as counts FROM generate_series(0,6) as g(d) CROSS JOIN (SELECT DISTINCT EXTRACT(YEAR FROM mv.violation_date)::int as y, mv.category as cat FROM ${SRC} WHERE ${w}) yc LEFT JOIN (SELECT EXTRACT(YEAR FROM mv.violation_date)::int as y, EXTRACT(DOW FROM mv.violation_date)::int as d, mv.category as cat, COUNT(*)::int as cnt FROM ${SRC} WHERE ${w} GROUP BY 1,2,3) data ON yc.y = data.y AND yc.cat = data.cat AND g.d = data.d GROUP BY 1,2 ORDER BY 1,2`,
		),
		// Category by hour
		q(
			`SELECT yc.y as year, yc.cat as category, array_agg(COALESCE(cnt, 0) ORDER BY g.hr) as counts FROM generate_series(0,23) as g(hr) CROSS JOIN (SELECT DISTINCT EXTRACT(YEAR FROM mv.violation_date)::int as y, mv.category as cat FROM ${SRC} WHERE ${w}) yc LEFT JOIN (SELECT EXTRACT(YEAR FROM mv.violation_date)::int as y, EXTRACT(HOUR FROM mv.violation_date)::int as h, mv.category as cat, COUNT(*)::int as cnt FROM ${SRC} WHERE ${w} GROUP BY 1,2,3) data ON yc.y = data.y AND yc.cat = data.cat AND g.hr = data.h GROUP BY 1,2 ORDER BY 1,2`,
		),
	]);

	const total = Number(totalRes.rows[0]?.cnt || 0) || 1;
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
	const by_weekday = wdRes.rows.map((r: any) => ({
		year: Number(r.year),
		counts: (r.counts || []).map(Number),
	}));
	const by_hour = hrRes.rows.map((r: any) => ({
		year: Number(r.year),
		counts: (r.counts || []).map(Number),
	}));

	// Maps for top_violations
	const catTvMap = new Map<string, any[]>();
	for (const r of catTvRes.rows as any[]) {
		catTvMap.set(r.category, r.top_violations || []);
	}
	const agTvMap = new Map<number, any[]>();
	for (const r of agTvRes.rows as any[]) {
		agTvMap.set(r.agent_id, r.top_violations || []);
	}
	const ayTvMap = new Map<string, any[]>();
	for (const r of ayTvRes.rows as any[]) {
		if (Number(r.rn) > tvl) continue;
		const key = `${r.year}-${r.agent_id}`;
		if (!ayTvMap.has(key)) ayTvMap.set(key, []);
		ayTvMap.get(key)!.push(r.tv);
	}
	const cyTvMap = new Map<string, any[]>();
	for (const r of cyTvRes.rows as any[]) {
		if (Number(r.rn) > tvl) continue;
		const key = `${r.year}-${r.category}`;
		if (!cyTvMap.has(key)) cyTvMap.set(key, []);
		cyTvMap.get(key)!.push(r.tv);
	}

	// Distinct law codes per category
	const lawCodesByCategory = new Map<string, number>();
	for (const r of catLcRes.rows as any[]) {
		lawCodesByCategory.set(r.category, Number(r.cnt));
	}

	// Agents by year map
	const ayMap = new Map<number, Map<number, number>>();
	for (const r of ayRes.rows as any[]) {
		const yr = Number(r.year),
			aid = Number(r.agent_id),
			cnt = Number(r.count);
		if (!ayMap.has(yr)) ayMap.set(yr, new Map());
		ayMap.get(yr)!.set(aid, cnt);
	}

	// Categories by year map
	const cyMap = new Map<number, Map<string, number>>();
	for (const r of cyRes.rows as any[]) {
		const yr = Number(r.year),
			cat = r.category,
			cnt = Number(r.count);
		if (!cyMap.has(yr)) cyMap.set(yr, new Map());
		cyMap.get(yr)!.set(cat, cnt);
	}

	// Categories by month: Map<category, Map<year, Map<month, count>>>
	const cmMap = new Map<string, Map<number, Map<number, number>>>();
	for (const r of cmRes.rows as any[]) {
		const cat = r.category as string,
			yr = Number(r.year),
			mo = Number(r.month),
			cnt = Number(r.count);
		if (!cmMap.has(cat)) cmMap.set(cat, new Map());
		const yearMap = cmMap.get(cat)!;
		if (!yearMap.has(yr)) yearMap.set(yr, new Map());
		yearMap.get(yr)!.set(mo, cnt);
	}

	// Categories by weekday: Map<category, Map<year, counts[]>>
	const cwMap = new Map<string, Map<number, number[]>>();
	for (const r of cwRes.rows as any[]) {
		const cat = r.category as string,
			yr = Number(r.year),
			counts = (r.counts || []).map(Number);
		if (!cwMap.has(cat)) cwMap.set(cat, new Map());
		cwMap.get(cat)!.set(yr, counts);
	}

	// Categories by hour: Map<category, Map<year, counts[]>>
	const chMap = new Map<string, Map<number, number[]>>();
	for (const r of chRes.rows as any[]) {
		const cat = r.category as string,
			yr = Number(r.year),
			counts = (r.counts || []).map(Number);
		if (!chMap.has(cat)) chMap.set(cat, new Map());
		chMap.get(cat)!.set(yr, counts);
	}

	const agents = agRes.rows.map((a: any) => {
		const info = AGENT_INFO[a.agent_id] ?? {
			description: `Agente ${a.agent_id}`,
			category: "manual" as const,
		};
		const byYear = Array.from(ayMap.entries())
			.sort(([ya], [yb]) => ya - yb)
			.map(([year, agentMap]) => {
				const yTot = Array.from(agentMap.values()).reduce((s, c) => s + c, 0);
				const count = agentMap.get(a.agent_id) || 0;
				return {
					year,
					count,
					percentage: yTot > 0 ? Math.round((count / yTot) * 1000) / 10 : 0,
					top_violations: ayTvMap.get(`${year}-${a.agent_id}`) || [],
				};
			});
		return {
			agent_id: a.agent_id,
			description: info.description,
			category: info.category,
			count: Number(a.count),
			percentage: Math.round((Number(a.count) / total) * 1000) / 10,
			top_violations: agTvMap.get(a.agent_id) || [],
			by_year: byYear,
		};
	});

	const category = catRes.rows.map((c: any) => {
		const byYear = Array.from(cyMap.entries())
			.sort(([ya], [yb]) => ya - yb)
			.map(([year, catMap]) => {
				const yTot = Array.from(catMap.values()).reduce((s, n) => s + n, 0);
				const count = catMap.get(c.category) || 0;
				return {
					year,
					count,
					percentage: yTot > 0 ? Math.round((count / yTot) * 1000) / 10 : 0,
					top_violations: cyTvMap.get(`${year}-${c.category}`) || [],
				};
			});
		const catMonthMap = cmMap.get(c.category);
		const by_month = catMonthMap
			? Array.from(catMonthMap.entries())
					.sort(([ya], [yb]) => ya - yb)
					.flatMap(([year, monthMap]) =>
						Array.from(monthMap.entries())
							.sort(([ma], [mb]) => ma - mb)
							.map(([month, count]) => ({ year, month, count })),
					)
			: [];
		const catWeekdayMap = cwMap.get(c.category);
		const by_weekday = catWeekdayMap
			? Array.from(catWeekdayMap.entries())
					.sort(([ya], [yb]) => ya - yb)
					.map(([year, counts]) => ({ year, counts }))
			: [];
		const catHourlyMap = chMap.get(c.category);
		const by_hour = catHourlyMap
			? Array.from(catHourlyMap.entries())
					.sort(([ya], [yb]) => ya - yb)
					.map(([year, counts]) => ({ year, counts }))
			: [];
		return {
			category: c.category,
			count: Number(c.count),
			percentage: Math.round((Number(c.count) / total) * 1000) / 10,
			law_codes_count: lawCodesByCategory.get(c.category) || 0,
			top_violations: catTvMap.get(c.category) || [],
			by_year: byYear,
			by_month,
			by_weekday,
			by_hour,
		};
	});

	const resp: any = {
		total_violations: total,
		period_start: pr.ps ? `${pr.ps}-01-01` : null,
		period_end: pr.pe ? `${pr.pe}-12-31` : null,
		violation_types_count: Number(typesRes.rows[0]?.cnt || 0),
		law_codes_count: Number(lawsRes.rows[0]?.cnt || 0),
		streets_count: Number(streetsRes.rows[0]?.cnt || 0),
		evolution: { by_year, by_month, by_weekday, by_hour },
		category,
		agents,
	};
	if (includeLawCodes) {
		resp.law_codes = lcRes.rows.map((lc: any) => ({
			law_code: lc.law_code,
			description: lc.description,
			count: Number(lc.count),
		}));
	}
	if (includeStreetInfo && streetCode != null) {
		const [streetNameRes, streetKmRes] = await Promise.all([
			db
				.select({ official_name: officialStreets.official_name })
				.from(officialStreets)
				.where(sql`${officialStreets.code} = ${streetCode}`)
				.limit(1),
			db
				.select({
					total_km: sql<number>`SUM(${pcrStreets.db2gse_sde}) / 1000.0`,
				})
				.from(pcrStreets)
				.where(sql`${pcrStreets.clogra_codi} = ${streetCode}`),
		]);
		const officialName = streetNameRes[0]?.official_name || null;
		const extensionKm = Number(streetKmRes[0]?.total_km) || 0;
		resp.street_info = {
			street_code: streetCode,
			official_name: officialName,
			extension_km: Math.round(extensionKm * 100) / 100,
			violations_per_km:
				extensionKm > 0
					? Math.round((Number(total) / extensionKm) * 100) / 100
					: 0,
		};
	}
	return c.json(resp, 200);
}
