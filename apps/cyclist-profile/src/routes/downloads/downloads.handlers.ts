import type { AppRouteHandler } from "../../lib/types.js";
import type { AggregateCsvRoute } from "./downloads.routes.js";

export const aggregateCsv: AppRouteHandler<AggregateCsvRoute> = async (c) => {
	// Redirect to cross endpoint and get data, then convert to CSV
	const body = c.req.valid("json");

	// Build params for cross endpoint call
	const crossParams = new URLSearchParams();
	crossParams.set("filters", JSON.stringify(body.filters || {}));
	crossParams.set("group_by", JSON.stringify(body.group_by || []));
	crossParams.set("compare_by", JSON.stringify(body.compare_by || []));
	crossParams.set("metrics", JSON.stringify(body.metrics || ["count"]));

	// Fetch cross data from our own API
	const url = new URL(c.req.url);
	const crossUrl = `${url.protocol}//${url.host}/v1/cross`;

	const response = await fetch(crossUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			filters: body.filters,
			group_by: body.group_by,
			compare_by: body.compare_by,
			metrics: body.metrics,
		}),
	});

	const json = (await response.json()) as {
		data: Record<string, unknown>[];
		meta: { group_by: string[]; compare_by: string[]; metrics: string[] };
	};

	const data = json.data || [];
	if (data.length === 0) {
		return c.text("No data", 200);
	}

	// Build CSV
	const allDims = [...(json.meta.group_by || []), ...(json.meta.compare_by || [])];
	const metricCols = json.meta.metrics || [];

	const headers = [...allDims.flatMap((d) => [`${d}_code`, `${d}_label`]), ...metricCols];

	const lines: string[] = [];
	lines.push(headers.join(","));

	for (const row of data) {
		const values: string[] = [];
		for (const dim of allDims) {
			const val = row[dim] as { code?: string; label?: string } | undefined;
			values.push(`"${val?.code || ""}"`, `"${val?.label || ""}"`);
		}
		for (const metric of metricCols) {
			const val = row[metric];
			values.push(val != null ? String(val) : "");
		}
		lines.push(values.join(","));
	}

	return c.text(lines.join("\n"), 200, {
		"Content-Type": "text/csv",
		"Content-Disposition": 'attachment; filename="perfil-ciclista-agregado.csv"',
	});
};
