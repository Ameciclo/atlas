import { createRoute, z } from "@hono/zod-openapi";

const violationCodesParam = z
	.string()
	.optional()
	.openapi({
		description: "Comma-separated violation codes (e.g. 7455,6050,5541). Alternative to 'category'.",
		example: "7455,7463,6050",
	});

const categoryParam = z
	.string()
	.optional()
	.openapi({
		description: "Predefined category filter (e.g. 'Segurança viária', 'Pedestres'). Resolves to violation_codes internally. Alternative to 'violation_codes'.",
		example: "Pedestres",
	});

const agentCategoryParam = z
	.enum(["all", "eletronico", "manual"])
	.default("all")
	.optional()
	.openapi({
		description: "Filter by agent category: eletronico (3,4,5,9) or manual (1,2,6,7,8)",
		example: "eletronico",
	});

const dateRangeParams = {
	start_date: z.string().date().optional().openapi({
		description: "Start date (YYYY-MM-DD)",
		example: "2020-01-01",
	}),
	end_date: z.string().date().optional().openapi({
		description: "End date (YYYY-MM-DD)",
		example: "2023-12-31",
	}),
};

const limitParam = z.coerce
	.number()
	.int()
	.min(1)
	.max(50)
	.default(10)
	.optional()
	.openapi({ description: "Number of results", example: 10 });

// ============================================================================
// 1. Overview
// ============================================================================

export const overviewRoute = createRoute({
	method: "get",
	path: "/dashboard/overview",
	tags: ["Dashboard"],
	summary: "Visão geral da base",
	description: "Cards do topo: total, período, nº de tipos, nº de ruas, breakdown por agente",
	responses: {
		200: {
			content: { "application/json": { schema: z.object({
				total_violations: z.number(),
				period_start: z.string().nullable(),
				period_end: z.string().nullable(),
				violation_types_count: z.number(),
				streets_count: z.number(),
				neighborhoods_count: z.number(),
				agent_breakdown: z.array(z.object({
					agent_id: z.number(),
					description: z.string(),
					count: z.number(),
					percentage: z.number(),
					category: z.enum(["eletronico", "manual"]),
				})),
			}) }},
			description: "Dashboard overview",
		},
	},
});

// ============================================================================
// 2. Top Violations
// ============================================================================

export const topViolationsRoute = createRoute({
	method: "get",
	path: "/dashboard/top-violations",
	tags: ["Dashboard"],
	summary: "Top infrações mais registradas",
	description: "Ranking principal de infrações com filtro por categoria de agente e códigos",
	request: {
		query: z.object({
			violation_codes: violationCodesParam,
			category: categoryParam,
			agent_category: agentCategoryParam,
			limit: limitParam,
			...dateRangeParams,
		}),
	},
	responses: {
		200: {
			content: { "application/json": { schema: z.object({
				violations: z.array(z.object({
					violation_code: z.string(),
					law_code: z.string(),
					description: z.string(),
					count: z.number(),
					percentage: z.number(),
				})),
			}) }},
			description: "Top violations",
		},
	},
});

// ============================================================================
// 3. Top Streets
export const topStreetsRoute = createRoute({
	method: "get",
	path: "/dashboard/top-streets",
	tags: ["Dashboard"],
	summary: "Top ruas com mais infrações",
	description: "Ranking de ruas por contagem de infrações, com filtro por códigos e datas",
	request: {
		query: z.object({
			violation_codes: violationCodesParam,
			category: categoryParam,
			agent_category: agentCategoryParam,
			limit: limitParam,
			...dateRangeParams,
		}),
	},
	responses: {
		200: {
			content: { "application/json": { schema: z.object({
				streets: z.array(z.object({
					street_code: z.number(),
					official_name: z.string(),
					neighborhood_name: z.string().nullable(),
					total_violations: z.number(),
					extension_km: z.number(),
					violations_per_km: z.number(),
				})),
			}) }},
			description: "Top streets by violations",
		},
	},
});

// ============================================================================
// 4. Temporal
export const temporalRoute = createRoute({
	method: "get",
	path: "/dashboard/temporal",
	tags: ["Dashboard"],
	summary: "Análise temporal das infrações",
	description: "Infrações por mês, dia da semana e hora do dia",
	request: {
		query: z.object({
			violation_codes: violationCodesParam,
			category: categoryParam,
			agent_category: agentCategoryParam,
			...dateRangeParams,
		}),
	},
	responses: {
		200: {
			content: { "application/json": { schema: z.object({
				by_month: z.record(z.number()),
				by_weekday: z.record(z.number()),
				by_hour: z.record(z.number()),
			}) }},
			description: "Temporal analysis",
		},
	},
});

// ============================================================================
// 5. Agent Analysis
export const agentAnalysisRoute = createRoute({
	method: "get",
	path: "/dashboard/agent-analysis",
	tags: ["Dashboard"],
	summary: "Quem fiscaliza o quê",
	description: "Breakdown por tipo de agente com top infrações por agente",
	request: {
		query: z.object({
			violation_codes: violationCodesParam,
			category: categoryParam,
			...dateRangeParams,
		}),
	},
	responses: {
		200: {
			content: { "application/json": { schema: z.object({
				agents: z.array(z.object({
					agent_id: z.number(),
					description: z.string(),
					category: z.enum(["eletronico", "manual"]),
					total: z.number(),
					percentage: z.number(),
					top_violations: z.array(z.object({
						violation_code: z.string(),
						law_code: z.string(),
						description: z.string(),
						count: z.number(),
					})),
				})),
			}) }},
			description: "Agent analysis",
		},
	},
});

// ============================================================================
// 6. Violation Codes Dictionary
// ============================================================================

export const violationCodesRoute = createRoute({
	method: "get",
	path: "/dashboard/violation-codes",
	tags: ["Dashboard"],
	summary: "Dicionário de códigos de infração",
	description: "Lista todos os códigos de infração com descrições para o frontend montar categorias",
	responses: {
		200: {
			content: { "application/json": { schema: z.object({
				codes: z.array(z.object({
					violation_code: z.string(),
					law_code: z.string(),
					description: z.string(),
					count: z.number(),
				})),
			}) }},
			description: "Violation codes dictionary",
		},
	},
});

// ============================================================================
// 7. Categories List
// ============================================================================

export const categoriesListRoute = createRoute({
	method: "get",
	path: "/dashboard/categories",
	tags: ["Dashboard"],
	summary: "Lista de categorias disponíveis",
	description: "Retorna as categorias predefinidas com contagem de códigos de infração em cada uma",
	responses: {
		200: {
			content: { "application/json": { schema: z.object({
				categories: z.array(z.object({
					category: z.string(),
					code_count: z.number(),
					total_violations: z.number(),
				})),
			}) }},
			description: "Available categories",
		},
	},
});
