import type { AppRouteHandler } from "../../lib/types.js";
import { db } from "../../db/index.js";
import type { QueryRoute } from "./cross.routes.js";

// Whitelist: API field name → JSONB source + label
const FIELD_MAP: Record<string, { source: string; label: string }> = {
	gender: { source: "data->>'gender'", label: "Genero" },
	race_color: { source: "data->>'color_race'", label: "Raca/Cor" },
	age_group: { source: "data->>'age_category'", label: "Faixa etaria" },
	schooling: { source: "data->>'schooling'", label: "Escolaridade" },
	income_range: { source: "data->>'age_standard'", label: "Faixa de renda" },
	bike_type: { source: "metadata->>'bike_type'", label: "Tipo de bicicleta" },
	years_using: { source: "data->>'years_using'", label: "Tempo de uso" },
	biggest_issue: { source: "data->>'biggest_issue'", label: "Maior problema" },
	biggest_need: { source: "data->>'biggest_need'", label: "Maior necessidade" },
	motivation_to_start: { source: "data->>'motivation_to_start'", label: "Motivacao para comecar" },
	motivation_to_continue: { source: "data->>'motivation_to_continue'", label: "Motivacao para continuar" },
	living_place: { source: "data->>'neighborhood_living'", label: "Bairro de moradia" },
	origin_place: { source: "data->>'neighborhood_origin'", label: "Bairro de origem" },
	destination_place: { source: "data->>'neighborhood_destiny'", label: "Bairro de destino" },
	transport_mode: { source: "data->>'transportation_combined'", label: "Transporte combinado" },
	weekday: { source: "metadata->>'weekday'", label: "Dia da semana" },
	area: { source: "metadata->>'area'", label: "Area" },
	point_neighborhood: { source: "metadata->>'neighborhood'", label: "Bairro do ponto" },
	year: { source: "metadata->>'survey_year'", label: "Ano" },
	hour: { source: "metadata->>'hour'", label: "Horario" },
};

interface MetricDef {
	sql: string;
	requiresTotal?: boolean;
}

const METRIC_MAP: Record<string, MetricDef> = {
	count: { sql: "count(*)" },
	collision_count: { sql: "count(*) filter (where data->>'collisions' = 'Sim')" },
	women_count: { sql: "count(*) filter (where data->>'gender' = 'Feminino')" },
	black_brown_count: {
		sql: "count(*) filter (where data->>'color_race' in ('Preta','Parda'))",
	},
	low_income_count: {
		sql: "count(*) filter (where data->>'age_standard' in ('Ate 1 salario minimo','De 1 a 2 salarios minimos'))",
	},
	frequent_count: {
		sql: "count(*) filter (where (data->'days_usage'->>'total')::int >= 5)",
	},
	work_use_count: {
		sql: "count(*) filter (where (data->'days_usage'->>'working')::int >= 1)",
	},
	school_use_count: {
		sql: "count(*) filter (where (data->'days_usage'->>'school')::int >= 1)",
	},
	leisure_use_count: {
		sql: "count(*) filter (where (data->'days_usage'->>'leisure')::int >= 1)",
	},
	shopping_use_count: {
		sql: "count(*) filter (where (data->'days_usage'->>'shopping')::int >= 1)",
	},
	transport_combination_count: {
		sql: "count(*) filter (where data->>'transport_combination' is not null and data->>'transport_combination' != '' and data->>'transport_combination' != 'Nao')",
	},
	distance_time_avg: { sql: "round(avg((data->>'distance_time')::numeric), 1)" },
	distance_time_median: {
		sql: "round(percentile_cont(0.5) within group (order by (data->>'distance_time')::numeric)::numeric, 1)",
	},
	distance_time_p25: {
		sql: "round(percentile_cont(0.25) within group (order by (data->>'distance_time')::numeric)::numeric, 1)",
	},
	distance_time_p75: {
		sql: "round(percentile_cont(0.75) within group (order by (data->>'distance_time')::numeric)::numeric, 1)",
	},
	age_avg: { sql: "round(avg((data->>'age')::numeric), 1)" },
	age_median: {
		sql: "round(percentile_cont(0.5) within group (order by (data->>'age')::numeric)::numeric, 1)",
	},
	days_total_avg: {
		sql: "round(avg((data->'days_usage'->>'total')::numeric), 1)",
	},
	// Derived (percent) metrics
	percent: { sql: "", requiresTotal: true },
	collision_percent: { sql: "", requiresTotal: true },
	women_percent: { sql: "", requiresTotal: true },
	black_brown_percent: { sql: "", requiresTotal: true },
	low_income_percent: { sql: "", requiresTotal: true },
	frequent_percent: { sql: "", requiresTotal: true },
	work_use_percent: { sql: "", requiresTotal: true },
	school_use_percent: { sql: "", requiresTotal: true },
	leisure_use_percent: { sql: "", requiresTotal: true },
	shopping_use_percent: { sql: "", requiresTotal: true },
	transport_combination_percent: { sql: "", requiresTotal: true },
};

function validateFields(fields: string[], label: string): string[] {
	const invalid = fields.filter((f) => !FIELD_MAP[f]);
	if (invalid.length > 0) {
		throw new Error(
			`Invalid ${label} field(s): ${invalid.join(", ")}. Allowed: ${Object.keys(FIELD_MAP).join(", ")}`,
		);
	}
	return fields;
}

function validateMetrics(metrics: string[]): string[] {
	const invalid = metrics.filter((m) => !METRIC_MAP[m]);
	if (invalid.length > 0) {
		throw new Error(
			`Invalid metric(s): ${invalid.join(", ")}. Allowed: ${Object.keys(METRIC_MAP).join(", ")}`,
		);
	}
	return metrics;
}

function esc(v: string): string {
	return `'${v.replace(/'/g, "''")}'`;
}

export const query: AppRouteHandler<QueryRoute> = async (c) => {
	try {
		const body = c.req.valid("json");
		const filters = (body.filters || {}) as Record<string, unknown>;
		const groupBy = validateFields(body.group_by || [], "group_by");
		const compareBy = validateFields(body.compare_by || [], "compare_by");
		const metrics = validateMetrics(body.metrics || []);
		const options = body.options || {};

		const allDims = [...groupBy, ...compareBy];

		// Build WHERE conditions (raw SQL strings for safety with whitelisted field sources)
		const conditions: string[] = [];

		const addIn = (source: string, vals: unknown) => {
			if (Array.isArray(vals) && vals.length > 0) {
				conditions.push(`${source} in (${vals.map((v) => esc(String(v))).join(", ")})`);
			}
		};

		const addRange = (source: string, min: unknown, max: unknown) => {
			if (min !== undefined && min !== null) conditions.push(`${source} >= ${Number(min)}`);
			if (max !== undefined && max !== null) conditions.push(`${source} <= ${Number(max)}`);
		};

		const addBool = (source: string, val: unknown) => {
			if (val === true) conditions.push(`${source} = 'Sim'`);
			else if (val === false)
				conditions.push(`(${source} is null or ${source} = '' or ${source} = 'Nao')`);
		};

		addIn("metadata->>'survey_year'", filters.year);
		addIn("data->>'gender'", filters.gender);
		addIn("data->>'color_race'", filters.race_color);
		addRange("(data->>'age')::int", filters.age_min, filters.age_max);
		addIn("data->>'age_category'", filters.age_group);
		addIn("data->>'schooling'", filters.schooling);
		addIn("data->>'age_standard'", filters.income_range);
		addIn("metadata->>'bike_type'", filters.bike_type);
		if (filters.collided !== undefined) addBool("data->>'collisions'", filters.collided);
		addRange("(data->'days_usage'->>'total')::int", filters.days_total_min, filters.days_total_max);
		addRange("(data->'days_usage'->>'working')::int", filters.days_working_min, filters.days_working_max);
		addIn("data->>'years_using'", filters.years_using);
		addRange("(data->>'distance_time')::int", filters.distance_time_min, filters.distance_time_max);
		addIn("data->>'biggest_issue'", filters.biggest_issue);
		addIn("data->>'biggest_need'", filters.biggest_need);
		addIn("data->>'motivation_to_start'", filters.motivation_to_start);
		addIn("data->>'motivation_to_continue'", filters.motivation_to_continue);
		addIn("data->>'neighborhood_living'", filters.living_place);
		addIn("data->>'neighborhood_origin'", filters.origin_place);
		addIn("data->>'neighborhood_destiny'", filters.destination_place);
		if (filters.combines_transport !== undefined) addBool("data->>'transport_combination'", filters.combines_transport);
		addIn("data->>'transportation_combined'", filters.transport_mode);
		addIn("metadata->>'weekday'", filters.weekday);
		addIn("metadata->>'area'", filters.area);
		addIn("metadata->>'neighborhood'", filters.point_neighborhood);

		const whereStr = conditions.length > 0 ? conditions.join(" and ") : "1=1";

		// Build SELECT expressions
		const selectParts: string[] = [];
		for (const dim of allDims) {
			const src = FIELD_MAP[dim]?.source;
			if (src) selectParts.push(`${src} as "${dim}"`);
		}

		const needsTotal = metrics.some((m) => METRIC_MAP[m]?.requiresTotal);
		const countMetrics = metrics.filter((m) => !METRIC_MAP[m]?.requiresTotal);
		for (const metric of countMetrics) {
			const sql = METRIC_MAP[metric]?.sql;
			if (sql) selectParts.push(`${sql} as "${metric}"`);
		}
		if (needsTotal) {
			selectParts.push(`count(*) as "_total"`);
		}

		// GROUP BY
		const groupParts = allDims.map((dim) => FIELD_MAP[dim]?.source).filter(Boolean) as string[];
		const groupStr = groupParts.length > 0 ? `group by ${groupParts.join(", ")}` : "";
		const havingStr = options.min_n ? `having count(*) >= ${options.min_n}` : "";

		// ORDER BY
		let orderStr = "";
		if (options.sort) {
			const field = options.sort.field;
			// Validate sort field is a known metric or dimension
			const dir = options.sort.direction === "desc" ? "desc" : "asc";
			orderStr = `order by "${field}" ${dir}`;
		} else {
			orderStr = 'order by "count" desc';
		}

		const limitStr = options.limit ? `limit ${options.limit}` : "";

		const fullQuery = [
			`select ${selectParts.join(", ")}`,
			"from cyclist_profiles",
			`where ${whereStr}`,
			groupStr,
			havingStr,
			orderStr,
			limitStr,
		]
			.filter(Boolean)
			.join(" ");

		const result = await db.execute(fullQuery);
		const rows = (result as { rows: Record<string, unknown>[] }).rows || [];

		// Compute total N
		const totalN = rows.reduce((sum, row) => sum + (Number(row.count) || Number(row._total) || 0), 0);

		// Post-process
		const data = rows.map((row) => {
			const item: Record<string, unknown> = { suppressed: false };
			const count = Number(row.count || row._total || 0);

			for (const dim of allDims) {
				const raw = String(row[dim] ?? "");
				item[dim] = { code: raw, label: raw || "(vazio)" };
			}

			// Suppression
			if (options.min_n && count < options.min_n) {
				item.suppressed = true;
				for (const metric of metrics) {
					item[metric] = null;
				}
				return item;
			}

			for (const metric of metrics) {
				const def = METRIC_MAP[metric];
				if (!def) continue;
				if (def.requiresTotal) {
					const baseField = metric.replace("_percent", "_count");
					const baseVal = Number(row[baseField] ?? 0);
					const pct = count > 0 ? (baseVal / count) * 100 : 0;
					item[metric] = Math.round(pct * 10) / 10;
				} else {
					const val = row[metric];
					item[metric] = val !== null && val !== undefined ? Number(val) : null;
				}
			}

			return item;
		});

		const warnings: string[] = [];
		if (data.length === 0) {
			warnings.push("Nenhum resultado encontrado com os filtros atuais.");
		}
		if (options.min_n && data.some((d) => d.suppressed)) {
			warnings.push(`Algumas celulas foram suprimidas por terem n < ${options.min_n}.`);
		}

		return c.json({
			meta: { group_by: groupBy, compare_by: compareBy, metrics },
			data,
			total_n: totalN,
			warnings: warnings.length > 0 ? warnings : undefined,
		});
	} catch (error) {
		return c.json(
			{
				error:
					error instanceof Error ? error.message : "Internal error",
				data: [],
				total_n: 0,
				meta: { group_by: [], compare_by: [], metrics: [] },
			},
			200,
		);
	}
};
