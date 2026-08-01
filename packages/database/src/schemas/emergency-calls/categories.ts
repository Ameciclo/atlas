import categoryMap from "./category-map.json" with { type: "json" };

export const CATEGORY_BUCKETS = categoryMap.buckets as readonly string[];

export const CATEGORY_MAP: Record<string, string> = categoryMap.map;

const DEFAULT_BUCKET = "nao_informado";

export function normalizeCategory(
	value: string | null | undefined,
): string {
	if (!value) return DEFAULT_BUCKET;
	const normalizedKey = value.trim();
	return (
		CATEGORY_MAP[normalizedKey] ||
		CATEGORY_MAP[normalizedKey.toUpperCase()] ||
		DEFAULT_BUCKET
	);
}

export function normalizeCategories(
	raw: Record<string, number>,
): Record<string, number> {
	const result: Record<string, number> = {};
	for (const bucket of CATEGORY_BUCKETS) {
		result[bucket] = 0;
	}
	for (const [key, value] of Object.entries(raw)) {
		const bucket = normalizeCategory(key);
		result[bucket] = (result[bucket] || 0) + (value || 0);
	}
	return result;
}
