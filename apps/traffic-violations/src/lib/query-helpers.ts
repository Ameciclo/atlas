import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { trafficViolations, trafficViolationsCatalog } from "../db/schema.js";

// ============================================================================
// Agent mapping
// ============================================================================

export const AGENT_INFO: Record<
	number,
	{ description: string; category: "eletronico" | "manual" }
> = {
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

export function getAgentIds(category: string): number[] {
	if (category === "eletronico") return ELETRONICO_IDS;
	if (category === "manual") return MANUAL_IDS;
	return [...ELETRONICO_IDS, ...MANUAL_IDS];
}

// ============================================================================
// Parameter parsing
// ============================================================================

export function parseCodes(raw: string | undefined): string[] | null {
	if (!raw) return null;
	const codes = raw
		.split(",")
		.map((c) => c.trim())
		.filter(Boolean);
	return codes.length > 0 ? codes : null;
}

// ============================================================================
// Category resolution — description-based via traffic_violations_catalog
// ============================================================================

async function buildCategoryCondition(category: string) {
	return sql`EXISTS (
		SELECT 1 FROM ${trafficViolationsCatalog} ic
		WHERE ic.category = ${category}
		  AND ${trafficViolations.description} = ANY(ic.known_variants)
	)`;
}

// ============================================================================
// Shared condition builder
// ============================================================================

export async function buildConditions(params: {
	codes?: string | undefined;
	category?: string | undefined;
	agentCategory?: string | undefined;
	startDate?: string | undefined;
	endDate?: string | undefined;
}) {
	const conditions: ReturnType<typeof and>[] = [];

	const explicitCodes = parseCodes(params.codes);

	if (explicitCodes) {
		conditions.push(inArray(trafficViolations.cttu_code, explicitCodes));
	}
	if (params.category) {
		conditions.push(await buildCategoryCondition(params.category));
	}

	const agentIds = getAgentIds(params.agentCategory || "all");
	if (params.agentCategory && params.agentCategory !== "all") {
		conditions.push(inArray(trafficViolations.agent_id, agentIds));
	}

	if (params.startDate) {
		conditions.push(
			gte(trafficViolations.violation_date, new Date(params.startDate)),
		);
	}
	if (params.endDate) {
		conditions.push(
			lte(trafficViolations.violation_date, new Date(params.endDate)),
		);
	}

	return conditions.length > 0 ? and(...conditions) : undefined;
}
