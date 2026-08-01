import { sql } from "drizzle-orm";
import { db } from "../../db/index.js";

function normalizeLaw(law: string): string {
	return law.toLowerCase().replace(/\s+/g, "").replace(/'/g, "''");
}

function q(sqlStr: string) {
	return db.execute(sql.raw(sqlStr));
}

export const lawStats = async (c: any) => {
	try {
		const { law } = c.req.valid("query");
		const normalized = normalizeLaw(law);

		const catalogResult = await db.execute(sql`
			SELECT id as violation_id, law_code, canonical_description as description
			FROM traffic_tickets_catalog
			WHERE LOWER(REGEXP_REPLACE(law_code, '\\s+', '', 'g')) LIKE ${`${normalized}%`}
			ORDER BY law_code, id
		`);

		const catalogRows = catalogResult.rows as any[];
		if (catalogRows.length === 0) {
			return c.json(
				{
					total_violations: 0,
					period_start: null,
					period_end: null,
					law_code_breakdown: [],
				},
				200,
			);
		}

		const violationIds = Array.from(
			new Set(catalogRows.map((r: any) => r.violation_id)),
		);
		const idList = violationIds.join(",");

		const SRC = "tv_mvs.violations_joined mv";

		const [totalRes, countRes, yearlyRes, monthlyRes, weekdayRes, hourlyRes] =
			await Promise.all([
				q(
					`SELECT COUNT(*)::int as total, MIN(EXTRACT(YEAR FROM mv.violation_date))::text as period_start, MAX(EXTRACT(YEAR FROM mv.violation_date))::text as period_end FROM ${SRC} WHERE mv.violation_id IN (${idList})`,
				),
				q(
					`SELECT mv.law_code, mv.canonical_description as description, COUNT(*)::int as count FROM ${SRC} WHERE mv.violation_id IN (${idList}) GROUP BY mv.law_code, mv.canonical_description ORDER BY count DESC`,
				),
				q(
					`SELECT mv.law_code, mv.canonical_description as description, mv.year, COUNT(*)::int as count FROM ${SRC} WHERE mv.violation_id IN (${idList}) GROUP BY mv.law_code, mv.canonical_description, mv.year ORDER BY mv.law_code, mv.canonical_description, mv.year`,
				),
				q(
					`SELECT mv.law_code, mv.canonical_description as description, mv.year, mv.month, COUNT(*)::int as count FROM ${SRC} WHERE mv.violation_id IN (${idList}) GROUP BY mv.law_code, mv.canonical_description, mv.year, mv.month ORDER BY mv.law_code, mv.canonical_description, mv.year, mv.month`,
				),
				q(
					`SELECT mv.law_code, mv.canonical_description as description, mv.year, mv.weekday, COUNT(*)::int as count FROM ${SRC} WHERE mv.violation_id IN (${idList}) GROUP BY mv.law_code, mv.canonical_description, mv.year, mv.weekday ORDER BY mv.law_code, mv.canonical_description, mv.year, mv.weekday`,
				),
				q(
					`SELECT mv.law_code, mv.canonical_description as description, mv.year, mv.hour, COUNT(*)::int as count FROM ${SRC} WHERE mv.violation_id IN (${idList}) GROUP BY mv.law_code, mv.canonical_description, mv.year, mv.hour ORDER BY mv.law_code, mv.canonical_description, mv.year, mv.hour`,
				),
			]);

		const totalRow = totalRes.rows[0] as any;
		const total = Number(totalRow?.total || 0);
		const periodStart = totalRow?.period_start
			? `${totalRow.period_start}-01-01`
			: null;
		const periodEnd = totalRow?.period_end
			? `${totalRow.period_end}-12-31`
			: null;

		const key = (lc: string, desc: string) => `${lc}|${desc}`;

		const yearlyMap = new Map<string, Map<number, number>>();
		for (const r of yearlyRes.rows as any[]) {
			const k = key(r.law_code, r.description);
			if (!yearlyMap.has(k)) yearlyMap.set(k, new Map());
			yearlyMap.get(k)!.set(Number(r.year), Number(r.count));
		}

		const monthlyMap = new Map<string, Map<number, Map<number, number>>>();
		for (const r of monthlyRes.rows as any[]) {
			const k = key(r.law_code, r.description);
			if (!monthlyMap.has(k)) monthlyMap.set(k, new Map());
			const ym = monthlyMap.get(k)!;
			const yr = Number(r.year);
			if (!ym.has(yr)) ym.set(yr, new Map());
			ym.get(yr)!.set(Number(r.month), Number(r.count));
		}

		const weekdayMap = new Map<string, Map<number, number[]>>();
		for (const r of weekdayRes.rows as any[]) {
			const k = key(r.law_code, r.description);
			if (!weekdayMap.has(k)) weekdayMap.set(k, new Map());
			const wm = weekdayMap.get(k)!;
			const yr = Number(r.year);
			if (!wm.has(yr)) wm.set(yr, Array(7).fill(0));
			wm.get(yr)![Number(r.weekday)] = Number(r.count);
		}

		const hourlyMap = new Map<string, Map<number, number[]>>();
		for (const r of hourlyRes.rows as any[]) {
			const k = key(r.law_code, r.description);
			if (!hourlyMap.has(k)) hourlyMap.set(k, new Map());
			const hm = hourlyMap.get(k)!;
			const yr = Number(r.year);
			if (!hm.has(yr)) hm.set(yr, Array(24).fill(0));
			hm.get(yr)![Number(r.hour)] = Number(r.count);
		}

		const law_code_breakdown = (countRes.rows as any[]).map((r: any) => {
			const lc = r.law_code as string;
			const desc = r.description as string;
			const count = Number(r.count);
			const k = key(lc, desc);
			const yMap = yearlyMap.get(k) || new Map();
			const mMap = monthlyMap.get(k) || new Map();
			const wMap = weekdayMap.get(k) || new Map();
			const hMap = hourlyMap.get(k) || new Map();

			const by_year = Array.from(yMap.entries())
				.sort(([ya], [yb]) => ya - yb)
				.map(([year, cnt]) => ({ year, count: cnt }));

			const by_month = Array.from(mMap.entries())
				.sort(([ya], [yb]) => ya - yb)
				.flatMap(([year, monthMapInner]) =>
					(Array.from(monthMapInner.entries()) as [number, number][])
						.sort(([ma], [mb]) => ma - mb)
						.map(([month, cnt]) => ({ year, month, count: cnt })),
				);

			const by_weekday = Array.from(wMap.entries())
				.sort(([ya], [yb]) => ya - yb)
				.map(([year, counts]) => ({ year, counts }));

			const by_hour = Array.from(hMap.entries())
				.sort(([ya], [yb]) => ya - yb)
				.map(([year, counts]) => ({ year, counts }));

			return {
				law_code: lc,
				description: desc,
				count,
				evolution: { by_year, by_month, by_weekday, by_hour },
			};
		});

		return c.json(
			{
				total_violations: total,
				period_start: periodStart,
				period_end: periodEnd,
				law_code_breakdown,
			},
			200,
		);
	} catch (error) {
		console.error("Error fetching law stats:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};
