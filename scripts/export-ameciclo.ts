/**
 * Exportação de Dados da Plataforma Ameciclo
 * Extrai dados de todos os endpoints listados em PLATAFORMA_DADOS.md
 * Executar com: npx tsx scripts/export-ameciclo.ts
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ─── Configuração ───

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = "http://localhost";
const OUTPUT_DIR = join(__dirname, "..", "exports", "ameciclo");
const REQUEST_TIMEOUT_MS = 300_000;
const MAX_RETRIES = 3;
const CONCURRENCY = 3;

// ─── Serviços ───

interface Service {
	port: number;
	name: string;
}

const SERVICES: Record<string, Service> = {
	"cyclist-profile": { port: 3000, name: "cyclist-profile" },
	"cyclist-counts": { port: 3002, name: "cyclist-counts" },
	"traffic-deaths": { port: 3003, name: "traffic-deaths" },
	"bicycle-racks": { port: 3005, name: "bicycle-racks" },
	"emergency-calls": { port: 3010, name: "emergency-calls" },
	"traffic-tickets": { port: 3013, name: "traffic-tickets" },
	"shared-bike": { port: 3015, name: "shared-bike" },
	"pcr-streets": { port: 3016, name: "pcr-streets" },
	"cycling-infra": { port: 3020, name: "cycling-infra" },
	ciclodados: { port: 3050, name: "ciclodados" },
	"traffic-calls": { port: 3019, name: "traffic-calls" },
};

// ─── Tipos ───

interface EndpointDef {
	page: string;
	service: string;
	endpoint: string;
	method: "GET" | "POST";
	params?: Record<string, string>;
	body?: unknown;
	paginated?: boolean;
	paginationField?: string;
	paginationMax?: number;
	flattenData?: string;
	externalUrl?: string;
	outputPrefix?: string;
	csvFields?: string[];
}

interface IndexRow {
	tema: string;
	servico: string;
	endpoint: string;
	parametros: string;
	arquivo: string;
	formato: string;
	numero_registros: number;
	status: string;
	observacao: string;
}

interface ErrorRow {
	servico: string;
	endpoint: string;
	parametros: string;
	status_http: string;
	erro: string;
	tentativa_realizada: string;
}

// ─── Utilidades ───

function ensureDir(dir: string) {
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
}

async function fetchWithRetry(
	url: string,
	options: RequestInit = {},
	retries = MAX_RETRIES,
): Promise<{ response: Response; body: unknown }> {
	for (let attempt = 1; attempt <= retries; attempt++) {
		try {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
			const response = await fetch(url, {
				...options,
				signal: controller.signal,
			});
			clearTimeout(timeout);
			const text = await response.text();
			let body: unknown;
			try {
				body = JSON.parse(text);
			} catch {
				body = text;
			}
			if (!response.ok && attempt < retries) {
				await sleep(1000 * attempt);
				continue;
			}
			return { response, body };
		} catch (err) {
			if (attempt === retries) throw err;
			await sleep(1000 * attempt);
		}
	}
	throw new Error(`Failed after ${retries} retries: ${url}`);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function jsonToCSV(data: Record<string, unknown>[]): string {
	if (!data.length) return "";
	const keys = Object.keys(data[0]);
	const header = keys.join(",");
	const rows = data.map((row) =>
		keys
			.map((k) => {
				const val = row[k];
				if (val === null || val === undefined) return "";
				const str = typeof val === "object" ? JSON.stringify(val) : String(val);
				if (str.includes(",") || str.includes('"') || str.includes("\n")) {
					return `"${str.replace(/"/g, '""')}"`;
				}
				return str;
			})
			.join(","),
	);
	return [header, ...rows].join("\n") + "\n";
}

function flattenObject(
	obj: Record<string, unknown>,
	prefix = "",
): Record<string, string> {
	const result: Record<string, string> = {};
	for (const [key, value] of Object.entries(obj)) {
		const newKey = prefix ? `${prefix}.${key}` : key;
		if (
			value !== null &&
			value !== undefined &&
			typeof value === "object" &&
			!Array.isArray(value)
		) {
			Object.assign(
				result,
				flattenObject(value as Record<string, unknown>, newKey),
			);
		} else {
			result[newKey] =
				value === null || value === undefined ? "" : String(value);
		}
	}
	return result;
}

function geojsonToCSV(features: Record<string, unknown>[]): string {
	if (!features.length) return "";
	const rows = features.map((f) =>
		flattenObject(f.properties as Record<string, unknown>),
	);
	return jsonToCSV(rows);
}

function countRecords(body: unknown): number {
	if (!body) return 0;
	if (Array.isArray(body)) return body.length;
	if (typeof body === "object" && body !== null) {
		const b = body as Record<string, unknown>;
		if (b.data && Array.isArray(b.data)) return (b.data as unknown[]).length;
		if (b.features && Array.isArray(b.features))
			return (b.features as unknown[]).length;
		if (b.total !== undefined) return Number(b.total);
		if (
			b.all &&
			typeof b.all === "object" &&
			(b.all as Record<string, unknown>).features
		)
			return (
				((b.all as Record<string, unknown>).features as unknown[])?.length ?? 0
			);
		if (Object.keys(b).length > 0) return 1;
	}
	return 0;
}

function extractArray(body: unknown, field?: string): unknown[] | null {
	if (!body) return null;
	if (Array.isArray(body)) return body;
	if (typeof body === "object" && body !== null) {
		const b = body as Record<string, unknown>;
		if (field && Array.isArray(b[field])) return b[field] as unknown[];
		if (Array.isArray(b.data)) return b.data as unknown[];
		if (b.features && Array.isArray(b.features)) {
			if (b.type === "FeatureCollection" || (!b.data && !b.total)) {
				return b.features as unknown[];
			}
		}
		return null;
	}
	return null;
}

function extractFeatures(body: unknown): unknown[] | null {
	if (!body || typeof body !== "object") return null;
	const b = body as Record<string, unknown>;
	if (Array.isArray(b.features)) return b.features as unknown[];
	if (b.all && typeof b.all === "object") {
		const all = b.all as Record<string, unknown>;
		if (Array.isArray(all.features)) return all.features as unknown[];
	}
	if (b.byCity && typeof b.byCity === "object") {
		const features: unknown[] = [];
		const bc = b.byCity as Record<string, Record<string, unknown>>;
		for (const city of Object.values(bc)) {
			if (city.features && Array.isArray(city.features))
				features.push(...city.features);
		}
		if (features.length) return features;
	}
	return null;
}

function formatFilename(
	page: string,
	endpoint: string,
	suffix: string,
	params?: Record<string, string>,
): string {
	const safe = endpoint.replace(/[\/:{}]/g, "_").replace(/^_+/, "");
	const paramStr = params
		? "_" +
			Object.entries(params)
				.map(([k, v]) => `${k}_${v}`)
				.join("_")
		: "";
	return `${page}/${safe}${paramStr}${suffix}`;
}

// ─── Index e Erros ───

const indexRows: IndexRow[] = [];
const errorRows: ErrorRow[] = [];

function addIndex(row: IndexRow) {
	indexRows.push(row);
}

function addError(
	service: string,
	endpoint: string,
	params: string,
	statusHttp: string,
	error: string,
) {
	errorRows.push({
		servico: service,
		endpoint,
		parametros: params,
		status_http: String(statusHttp),
		erro: error,
		tentativa_realizada: new Date().toISOString(),
	});
}

// ─── Fetch e Save ───

async function fetchEndpoint(def: EndpointDef): Promise<void> {
	const base =
		def.externalUrl || `${BASE_URL}:${SERVICES[def.service]?.port || "?"}`;
	let url = `${base}${def.endpoint}`;

	const entries: [string, string][] = Object.entries(def.params ?? {});
	if (entries.length) {
		const qs = entries
			.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
			.join("&");
		url += `?${qs}`;
	}

	const options: RequestInit = { method: def.method };
	if (def.body) {
		options.headers = { "Content-Type": "application/json" };
		options.body = JSON.stringify(def.body);
	}

	console.log(`  [FETCH] ${def.method} ${url}`);

	const { response, body } = await fetchWithRetry(url, options);

	if (!response.ok) {
		const statusStr = String(response.status);
		const msg =
			typeof body === "object"
				? JSON.stringify(body).slice(0, 300)
				: String(body).slice(0, 300);
		addError(
			def.service,
			def.endpoint,
			JSON.stringify(def.params ?? {}),
			statusStr,
			msg,
		);
		console.log(`    ERROR ${statusStr}: ${msg}`);
		return;
	}

	const pageName = def.page;
	const paramStr = JSON.stringify(def.params ?? {});
	const prefix =
		def.outputPrefix || formatFilename(pageName, def.endpoint, "", def.params);

	// Salvar JSON bruto
	const jsonPath = join(OUTPUT_DIR, `${prefix}.json`);
	ensureDir(join(OUTPUT_DIR, pageName));
	writeFileSync(jsonPath, JSON.stringify(body, null, 2), "utf-8");

	let recordCount = 0;

	// Extração de array para CSV
	let arr = extractArray(body, def.flattenData);
	if (!arr) arr = extractFeatures(body);

	// Se não encontrou array, usar o countRecords
	if (!arr) {
		recordCount = countRecords(body);
	} else {
		recordCount = arr.length;
	}

	// CSV: se houver array tabular
	if (arr && arr.length > 0 && !isGeoJSONAsRoot(body)) {
		const csvData = arr.map((item) =>
			typeof item === "object" && item !== null
				? flattenObject(item as Record<string, unknown>)
				: { value: String(item) },
		);
		const csv = jsonToCSV(csvData);
		const csvPath = join(OUTPUT_DIR, `${prefix}.csv`);
		writeFileSync(csvPath, csv, "utf-8");
		addIndex({
			tema: pageName,
			servico: def.service,
			endpoint: def.endpoint,
			parametros: paramStr,
			arquivo: `${prefix}.csv`,
			formato: "CSV",
			numero_registros: recordCount,
			status: "completo",
			observacao: "",
		});
	}

	// GeoJSON: se houver features
	const features = extractFeatures(body);
	if (features && features.length > 0) {
		// Salvar GeoJSON dedicado
		const geojsonPath = join(OUTPUT_DIR, `${prefix}.geojson`);
		writeFileSync(geojsonPath, JSON.stringify(body, null, 2), "utf-8");

		// CSV das propriedades
		if (Array.isArray(arr)) {
			const props = features.map((f) => {
				const feat = f as Record<string, unknown>;
				return feat.properties || feat;
			});
			const csvProps = jsonToCSV(
				props.map((p) => flattenObject(p as Record<string, unknown>)),
			);
			const csvPropsPath = join(OUTPUT_DIR, `${prefix}_properties.csv`);
			writeFileSync(csvPropsPath, csvProps, "utf-8");
		}
	}

	addIndex({
		tema: pageName,
		servico: def.service,
		endpoint: def.endpoint,
		parametros: paramStr,
		arquivo: `${prefix}.json`,
		formato: features?.length ? "GeoJSON" : "JSON",
		numero_registros: recordCount,
		status: "completo",
		observacao: features?.length
			? `GeoJSON com ${features.length} features`
			: "",
	});
}

function isGeoJSONAsRoot(body: unknown): boolean {
	if (!body || typeof body !== "object") return false;
	const b = body as Record<string, unknown>;
	return b.type === "FeatureCollection" && Array.isArray(b.features);
}

// ─── Paginação: Emergency Calls /v1/calls ───

async function fetchPaginatedCalls(pageDef: string) {
	const service = "emergency-calls";
	const base = `${BASE_URL}:${SERVICES[service].port}`;
	const endpoint = "/v1/calls";
	const perPage = 1000;

	// Primeira chamada para obter total
	const { response, body } = await fetchWithRetry(
		`${base}${endpoint}?limit=${perPage}&offset=0`,
	);
	if (!response.ok) {
		addError(
			service,
			endpoint,
			"limit=1000,offset=0",
			String(response.status),
			JSON.stringify(body).slice(0, 300),
		);
		return;
	}

	const total = (body as Record<string, unknown>).total as number;
	const allData: unknown[] = [
		...(((body as Record<string, unknown>).data as unknown[]) || []),
	];
	const totalPages = Math.ceil(total / perPage);

	console.log(`  [PAGE] ${endpoint} total=${total} pages=${totalPages}`);

	for (let offset = perPage; offset < total; offset += perPage) {
		const { response: r2, body: b2 } = await fetchWithRetry(
			`${base}${endpoint}?limit=${perPage}&offset=${offset}`,
		);
		if (!r2.ok) {
			addError(
				service,
				endpoint,
				`limit=${perPage},offset=${offset}`,
				String(r2.status),
				JSON.stringify(b2).slice(0, 300),
			);
			continue;
		}
		const pageData = ((b2 as Record<string, unknown>).data as unknown[]) || [];
		allData.push(...pageData);
		if (offset % (perPage * 10) === 0) {
			console.log(
				`    progress: ${Math.min(offset + perPage, total)}/${total}`,
			);
		}
	}

	// Salvar consolidado
	ensureDir(join(OUTPUT_DIR, pageDef));
	const consolidated = { data: allData, total: allData.length };
	const jsonPath = join(OUTPUT_DIR, `${pageDef}/calls_consolidated.json`);
	writeFileSync(jsonPath, JSON.stringify(consolidated, null, 2), "utf-8");

	// JSONL para conjuntos grandes
	const jsonlPath = join(OUTPUT_DIR, `${pageDef}/calls_consolidated.jsonl`);
	const jsonl = allData.map((r) => JSON.stringify(r)).join("\n") + "\n";
	writeFileSync(jsonlPath, jsonl, "utf-8");

	// CSV
	const csvData = allData.map((r) =>
		flattenObject(r as Record<string, unknown>),
	);
	const csv = jsonToCSV(csvData);
	writeFileSync(
		join(OUTPUT_DIR, `${pageDef}/calls_consolidated.csv`),
		csv,
		"utf-8",
	);

	addIndex({
		tema: pageDef,
		servico: service,
		endpoint,
		parametros: "limit=1000, offset pagination",
		arquivo: `${pageDef}/calls_consolidated.json`,
		formato: "JSON (paginated consolidated)",
		numero_registros: allData.length,
		status: "completo",
		observacao: `Total API: ${total}. Exportado: ${allData.length}`,
	});

	// Também salvar respostas individuais do /v1/calls
	const { response: r1, body: b1 } = await fetchWithRetry(
		`${base}${endpoint}?limit=${perPage}&offset=0`,
	);
	if (r1.ok) {
		writeFileSync(
			join(OUTPUT_DIR, `${pageDef}/calls_page_0.json`),
			JSON.stringify(b1, null, 2),
			"utf-8",
		);
	}
}

// ─── Paginação: Traffic Tickets /v1/streets ───

async function fetchPaginatedStreets(pageDef: string) {
	const service = "traffic-tickets";
	const base = `${BASE_URL}:${SERVICES[service].port}`;
	const endpoint = "/v1/streets";
	const perPage = 100;

	const { response, body } = await fetchWithRetry(
		`${base}${endpoint}?limit=${perPage}&page=1`,
	);
	if (!response.ok) {
		addError(
			service,
			endpoint,
			"limit=100,page=1",
			String(response.status),
			JSON.stringify(body).slice(0, 300),
		);
		return;
	}

	const pagination = (body as Record<string, unknown>).pagination as Record<
		string,
		number
	>;
	const total = pagination.total;
	const totalPages = pagination.totalPages;
	const allData: unknown[] = [
		...(((body as Record<string, unknown>).data as unknown[]) || []),
	];

	console.log(`  [PAGE] ${endpoint} total=${total} pages=${totalPages}`);

	for (let page = 2; page <= totalPages; page++) {
		const { response: r2, body: b2 } = await fetchWithRetry(
			`${base}${endpoint}?limit=${perPage}&page=${page}`,
		);
		if (!r2.ok) {
			addError(
				service,
				endpoint,
				`limit=${perPage},page=${page}`,
				String(r2.status),
				JSON.stringify(b2).slice(0, 300),
			);
			continue;
		}
		const pageData = ((b2 as Record<string, unknown>).data as unknown[]) || [];
		allData.push(...pageData);
		if (page % 10 === 0) {
			console.log(`    progress: ${page}/${totalPages}`);
		}
	}

	ensureDir(join(OUTPUT_DIR, pageDef));
	const consolidated = { data: allData, total: allData.length };
	writeFileSync(
		join(OUTPUT_DIR, `${pageDef}/streets_consolidated.json`),
		JSON.stringify(consolidated, null, 2),
		"utf-8",
	);

	const csv = jsonToCSV(
		allData.map((r) => flattenObject(r as Record<string, unknown>)),
	);
	writeFileSync(
		join(OUTPUT_DIR, `${pageDef}/streets_consolidated.csv`),
		csv,
		"utf-8",
	);

	addIndex({
		tema: pageDef,
		servico: service,
		endpoint,
		parametros: "limit=100, page pagination",
		arquivo: `${pageDef}/streets_consolidated.json`,
		formato: "JSON (paginated consolidated)",
		numero_registros: allData.length,
		status: "completo",
		observacao: `Total API: ${total}. Exportado: ${allData.length}`,
	});
}

// ─── Definição dos Endpoints ───

// Mapeamento baseado no PLATAFORMA_DADOS.md + inspeção de código
function buildEndpoints(): EndpointDef[] {
	const endpoints: EndpointDef[] = [];

	// 1. CicloDados (page: ciclodados)
	endpoints.push(
		{
			page: "ciclodados",
			service: "cycling-infra",
			endpoint: "/v1/ways/all-ways",
			method: "GET",
			outputPrefix: "ciclodados/all_ways",
		},
		{
			page: "ciclodados",
			service: "cyclist-counts",
			endpoint: "/v1/locations",
			method: "GET",
			outputPrefix: "ciclodados/cyclist_locations",
		},
		{
			page: "ciclodados",
			service: "bicycle-racks",
			endpoint: "/v1/bicycle-racks/geojson",
			method: "GET",
			outputPrefix: "ciclodados/bicycle_racks",
		},
		{
			page: "ciclodados",
			service: "shared-bike",
			endpoint: "/v1/stations",
			method: "GET",
			outputPrefix: "ciclodados/shared_bike_stations",
		},
		{
			page: "ciclodados",
			service: "traffic-tickets",
			endpoint: "/v1/streets/geojson",
			method: "GET",
			outputPrefix: "ciclodados/traffic_tickets_geojson",
		},
		{
			page: "ciclodados",
			service: "cyclist-profile",
			endpoint: "/v1/cyclist-profiles/survey-locations",
			method: "GET",
			outputPrefix: "ciclodados/survey_locations",
		},
	);

	// 2. Contagens
	endpoints.push(
		{
			page: "contagens",
			service: "cyclist-counts",
			endpoint: "/v1/locations",
			method: "GET",
			outputPrefix: "contagens/locations",
		},
		{
			page: "contagens",
			service: "cyclist-counts",
			endpoint: "/v1/summary",
			method: "GET",
			outputPrefix: "contagens/summary",
		},
		{
			page: "contagens",
			service: "cyclist-counts",
			endpoint: "/v1/events",
			method: "GET",
			outputPrefix: "contagens/events",
		},
	);

	// 3. Perfil do Ciclista
	endpoints.push(
		{
			page: "perfil_ciclista",
			service: "cyclist-profile",
			endpoint: "/v1/cyclist-profiles",
			method: "GET",
			outputPrefix: "perfil_ciclista/profiles",
		},
		{
			page: "perfil_ciclista",
			service: "cyclist-profile",
			endpoint: "/v1/cyclist-profiles/summary",
			method: "GET",
			outputPrefix: "perfil_ciclista/profiles_summary",
		},
		{
			page: "perfil_ciclista",
			service: "cyclist-profile",
			endpoint: "/v1/cyclist-profiles/trends",
			method: "GET",
			outputPrefix: "perfil_ciclista/trends",
		},
		{
			page: "perfil_ciclista",
			service: "cyclist-profile",
			endpoint: "/v1/cyclist-profiles/gender-analysis",
			method: "GET",
			outputPrefix: "perfil_ciclista/gender_analysis",
		},
		{
			page: "perfil_ciclista",
			service: "cyclist-profile",
			endpoint: "/v1/cyclist-profiles/safety-analysis",
			method: "GET",
			outputPrefix: "perfil_ciclista/safety_analysis",
		},
		{
			page: "perfil_ciclista",
			service: "cyclist-profile",
			endpoint: "/v1/filters",
			method: "GET",
			outputPrefix: "perfil_ciclista/filters",
		},
		{
			page: "perfil_ciclista",
			service: "cyclist-profile",
			endpoint: "/v1/dictionary",
			method: "GET",
			outputPrefix: "perfil_ciclista/dictionary",
		},
		{
			page: "perfil_ciclista",
			service: "cyclist-profile",
			endpoint: "/v1/points",
			method: "GET",
			outputPrefix: "perfil_ciclista/points",
		},
		{
			page: "perfil_ciclista",
			service: "cyclist-profile",
			endpoint: "/v1/points.geojson",
			method: "GET",
			outputPrefix: "perfil_ciclista/points_geojson",
		},
	);

	// 4. Execução Cicloviária
	endpoints.push(
		{
			page: "execucao_cicloviaria",
			service: "cycling-infra",
			endpoint: "/v1/ways/summary",
			method: "GET",
			outputPrefix: "execucao_cicloviaria/ways_summary",
		},
		{
			page: "execucao_cicloviaria",
			service: "cycling-infra",
			endpoint: "/v1/ways/all-ways",
			method: "GET",
			outputPrefix: "execucao_cicloviaria/all_ways",
		},
		{
			page: "execucao_cicloviaria",
			service: "cycling-infra",
			endpoint: "/v1/infrastructure/summary",
			method: "GET",
			outputPrefix: "execucao_cicloviaria/infra_summary",
		},
		{
			page: "execucao_cicloviaria",
			service: "cycling-infra",
			endpoint: "/v1/relations",
			method: "GET",
			outputPrefix: "execucao_cicloviaria/relations",
		},
		{
			page: "execucao_cicloviaria",
			service: "cycling-infra",
			endpoint: "/relations/by-city",
			method: "GET",
			outputPrefix: "execucao_cicloviaria/relations_by_city",
		},
	);

	// 5. Infrações
	endpoints.push(
		{
			page: "infracoes",
			service: "traffic-tickets",
			endpoint: "/v1/overview",
			method: "GET",
			outputPrefix: "infracoes/overview",
		},
		{
			page: "infracoes",
			service: "traffic-tickets",
			endpoint: "/v1/violation-codes",
			method: "GET",
			outputPrefix: "infracoes/violation_codes",
		},
		{
			page: "infracoes",
			service: "traffic-tickets",
			endpoint: "/v1/streets/geojson",
			method: "GET",
			outputPrefix: "infracoes/streets_geojson",
		},
		{
			page: "infracoes",
			service: "traffic-tickets",
			endpoint: "/v1/law-stats",
			method: "GET",
			params: { law: "Art. 201" },
			outputPrefix: "infracoes/law_stats_art201",
		},
		{
			page: "infracoes",
			service: "traffic-tickets",
			endpoint: "/v1/street-stats",
			method: "GET",
			params: { street_code: "119385" },
			outputPrefix: "infracoes/street_stats_119385",
		},
	);

	// 6. Chamados de Emergência
	endpoints.push(
		{
			page: "chamados_emergencia",
			service: "emergency-calls",
			endpoint: "/v1/summary",
			method: "GET",
			outputPrefix: "chamados_emergencia/summary",
		},
		{
			page: "chamados_emergencia",
			service: "emergency-calls",
			endpoint: "/v1/cities",
			method: "GET",
			outputPrefix: "chamados_emergencia/cities",
		},
		{
			page: "chamados_emergencia",
			service: "emergency-calls",
			endpoint: "/v1/calls/summary",
			method: "GET",
			outputPrefix: "chamados_emergencia/calls_summary",
		},
		{
			page: "chamados_emergencia",
			service: "emergency-calls",
			endpoint: "/v1/calls/cities",
			method: "GET",
			outputPrefix: "chamados_emergencia/calls_cities",
		},
		{
			page: "chamados_emergencia",
			service: "emergency-calls",
			endpoint: "/v1/calls/outcomes",
			method: "GET",
			params: { city: "RECIFE" },
			outputPrefix: "chamados_emergencia/outcomes_RECIFE",
		},
		{
			page: "chamados_emergencia",
			service: "emergency-calls",
			endpoint: "/v1/calls/profiles",
			method: "GET",
			params: { city: "RECIFE" },
			outputPrefix: "chamados_emergencia/profiles_RECIFE",
		},
		{
			page: "chamados_emergencia",
			service: "emergency-calls",
			endpoint: "/v1/streets/summary",
			method: "GET",
			outputPrefix: "chamados_emergencia/streets_summary",
		},
		{
			page: "chamados_emergencia",
			service: "emergency-calls",
			endpoint: "/v1/streets/top",
			method: "GET",
			params: { limit: "150" },
			outputPrefix: "chamados_emergencia/streets_top150",
		},
	);

	// 7. Vias Inseguras
	const v2City = "RECIFE";
	endpoints.push(
		{
			page: "vias_inseguras",
			service: "emergency-calls",
			endpoint: `/v2/unsafe-streets/cities/${v2City}/summary`,
			method: "GET",
			outputPrefix: `vias_inseguras/summary_${v2City}`,
		},
		{
			page: "vias_inseguras",
			service: "emergency-calls",
			endpoint: `/v2/unsafe-streets/cities/${v2City}/concentration`,
			method: "GET",
			outputPrefix: `vias_inseguras/concentration_${v2City}`,
		},
		{
			page: "vias_inseguras",
			service: "emergency-calls",
			endpoint: `/v2/unsafe-streets/cities/${v2City}/geojson`,
			method: "GET",
			outputPrefix: `vias_inseguras/geojson_${v2City}`,
		},
		{
			page: "vias_inseguras",
			service: "emergency-calls",
			endpoint: "/v2/streets/history",
			method: "GET",
			params: { via: "BOA VIAGEM" },
			outputPrefix: "vias_inseguras/history_BOA_VIAGEM",
		},
		{
			page: "vias_inseguras",
			service: "emergency-calls",
			endpoint: "/v1/streets/search",
			method: "GET",
			params: { street: "Boa Viagem", limit: "100" },
			outputPrefix: "vias_inseguras/search_Boa_Viagem",
		},
	);

	// 8. Sinistros Fatais
	endpoints.push(
		{
			page: "sinistros_fatais",
			service: "traffic-deaths",
			endpoint: "/v1/summary",
			method: "GET",
			outputPrefix: "sinistros_fatais/summary",
		},
		{
			page: "sinistros_fatais",
			service: "traffic-deaths",
			endpoint: "/v1/cities-by-year",
			method: "GET",
			outputPrefix: "sinistros_fatais/cities_by_year",
		},
		{
			page: "sinistros_fatais",
			service: "traffic-deaths",
			endpoint: "/v1/filtros",
			method: "GET",
			outputPrefix: "sinistros_fatais/filtros",
		},
		{
			page: "sinistros_fatais",
			service: "traffic-deaths",
			endpoint: "/v1/matrix",
			method: "GET",
			outputPrefix: "sinistros_fatais/matrix",
		},
		{
			page: "sinistros_fatais",
			service: "traffic-deaths",
			endpoint: "/v1/causas-secundarias",
			method: "GET",
			outputPrefix: "sinistros_fatais/causas_secundarias",
		},
		{
			page: "sinistros_fatais",
			service: "traffic-deaths",
			endpoint: "/v1/cities-by-year",
			method: "GET",
			params: { tipoLocal: "residencia" },
			outputPrefix: "sinistros_fatais/cities_by_year_residencia",
		},
	);

	// 9. Orçamento PE (state-budget - serviço ausente)
	// Registrado como erro na hora da execução

	// 10. Orçamento Recife (recife-budget - serviço ausente)
	// Registrado como erro na hora da execução

	// 11. Bicicletários
	endpoints.push(
		{
			page: "bicicletarios",
			service: "bicycle-racks",
			endpoint: "/v1/bicycle-racks/geojson",
			method: "GET",
			outputPrefix: "bicicletarios/geojson",
		},
		{
			page: "bicicletarios",
			service: "bicycle-racks",
			endpoint: "/v1/bicycle-racks",
			method: "GET",
			outputPrefix: "bicicletarios/all",
		},
		{
			page: "bicicletarios",
			service: "bicycle-racks",
			endpoint: "/v1/bicycle-racks/stats",
			method: "GET",
			outputPrefix: "bicicletarios/stats",
		},
	);

	// 12. Bike PE
	endpoints.push({
		page: "bike_pe",
		service: "shared-bike",
		endpoint: "/v1/stations",
		method: "GET",
		outputPrefix: "bike_pe/stations",
	});

	// 13. IDECiclo (API externa)
	endpoints.push(
		{
			page: "ideciclo",
			service: "ideciclo",
			endpoint: "/reviews",
			method: "GET",
			externalUrl: "https://api.ideciclo.ameciclo.org",
			outputPrefix: "ideciclo/reviews",
		},
		{
			page: "ideciclo",
			service: "ideciclo",
			endpoint: "/structures",
			method: "GET",
			externalUrl: "https://api.ideciclo.ameciclo.org",
			outputPrefix: "ideciclo/structures",
		},
		{
			page: "ideciclo",
			service: "ideciclo",
			endpoint: "/forms",
			method: "GET",
			externalUrl: "https://api.ideciclo.ameciclo.org",
			outputPrefix: "ideciclo/forms",
		},
	);

	// 14. CMS Strapi
	endpoints.push({
		page: "cms",
		service: "strapi",
		endpoint: "/api/plataformas-de-dados",
		method: "GET",
		externalUrl: "https://do.strapi.ameciclo.org",
		outputPrefix: "cms/plataformas_de_dados",
	});

	// 15. ciclodados endpoint nearby (precisa lat/lng)
	// Nota: este endpoint requer coordenadas. Para completude, faremos chamada com as coordenadas do Recife.
	endpoints.push(
		{
			page: "ciclodados",
			service: "ciclodados",
			endpoint: "/v1/nearby",
			method: "GET",
			params: { lat: "-8.0476", lng: "-34.8770" },
			outputPrefix: "ciclodados/nearby_recife_centro",
		},
		{
			page: "ciclodados",
			service: "ciclodados",
			endpoint: "/v1/streets/search",
			method: "GET",
			params: { q: "Boa Viagem", limit: "10" },
			outputPrefix: "ciclodados/streets_search_Boa_Viagem",
		},
	);

	// cycling-infra additional full data
	endpoints.push(
		{
			page: "execucao_cicloviaria",
			service: "cycling-infra",
			endpoint: "/v1/ways",
			method: "GET",
			outputPrefix: "execucao_cicloviaria/ways",
		},
		{
			page: "execucao_cicloviaria",
			service: "cycling-infra",
			endpoint: "/v1/infrastructure/city-coverage",
			method: "GET",
			outputPrefix: "execucao_cicloviaria/city_coverage",
		},
		{
			page: "execucao_cicloviaria",
			service: "cycling-infra",
			endpoint: "/v1/infrastructure/cycleways",
			method: "GET",
			outputPrefix: "execucao_cicloviaria/cycleways",
		},
	);

	// traffic-tickets additional
	endpoints.push({
		page: "infracoes",
		service: "traffic-tickets",
		endpoint: "/v1/law-stats",
		method: "GET",
		params: { law: "Art. 253-A" },
		outputPrefix: "infracoes/law_stats_art253a",
	});

	return endpoints;
}

// ─── Endpoints com parâmetros que precisam de descoberta ───

async function fetchParametrizedEndpoints() {
	console.log("\n=== Endpoints parametrizados (descoberta de valores) ===\n");

	// law-stats: listar leis disponíveis
	try {
		const { response, body } = await fetchWithRetry(
			`${BASE_URL}:3013/v1/violation-codes`,
		);
		if (response.ok) {
			const data = body as Record<string, unknown>;
			const codes = (data.codes || data.data || []) as Record<
				string,
				unknown
			>[];
			const savedLaws = new Set<string>();
			for (const law of ["Art. 201", "Art. 253-A"]) savedLaws.add(law);

			if (codes.length > 0) {
				const pageDir = "infracoes";
				ensureDir(join(OUTPUT_DIR, pageDir));

				for (const code of codes) {
					const lawCode = (code.code ||
						code.codigo ||
						code.article ||
						"") as string;
					if (lawCode && !savedLaws.has(lawCode)) {
						savedLaws.add(lawCode);
						const safeName = lawCode.replace(/[^a-zA-Z0-9\-_.]/g, "_");
						try {
							const { response: r2, body: b2 } = await fetchWithRetry(
								`${BASE_URL}:3013/v1/law-stats?law=${encodeURIComponent(lawCode)}`,
							);
							if (r2.ok) {
								writeFileSync(
									join(OUTPUT_DIR, pageDir, `law_stats_${safeName}.json`),
									JSON.stringify(b2, null, 2),
									"utf-8",
								);
								addIndex({
									tema: pageDir,
									servico: "traffic-tickets",
									endpoint: "/v1/law-stats",
									parametros: `law=${lawCode}`,
									arquivo: `${pageDir}/law_stats_${safeName}.json`,
									formato: "JSON",
									numero_registros: countRecords(b2),
									status: "completo",
									observacao: "",
								});
							}
						} catch {
							addError(
								"traffic-tickets",
								"/v1/law-stats",
								`law=${lawCode}`,
								"?",
								"Falha na requisição",
							);
						}
					}
				}
			}
		}
	} catch (err) {
		console.log("  Erro ao descobrir leis:", String(err));
	}

	// cities nos emergency-calls para chamar por cidade
	try {
		const { response, body } = await fetchWithRetry(
			`${BASE_URL}:3010/v1/cities`,
		);
		if (response.ok) {
			const data = body as Record<string, unknown>;
			const cities = (data.cidades || data.data || []) as Record<
				string,
				unknown
			>[];
			const savedCities = new Set<string>(["RECIFE"]);

			for (const city of cities) {
				const cityName = (city.municipio_samu ||
					city.name ||
					city.nome ||
					"") as string;
				if (cityName && !savedCities.has(cityName)) {
					savedCities.add(cityName);

					// outcomes e profiles por cidade
					for (const subPath of ["outcomes", "profiles"]) {
						try {
							const { response: r2, body: b2 } = await fetchWithRetry(
								`${BASE_URL}:3010/v1/calls/${subPath}?city=${encodeURIComponent(cityName)}`,
							);
							if (r2.ok) {
								const pageDir = "chamados_emergencia";
								ensureDir(join(OUTPUT_DIR, pageDir));
								const filePrefix = `${pageDir}/${subPath}_${cityName.replace(/[^a-zA-Z0-9]/g, "_")}`;
								writeFileSync(
									join(OUTPUT_DIR, `${filePrefix}.json`),
									JSON.stringify(b2, null, 2),
									"utf-8",
								);
								addIndex({
									tema: pageDir,
									servico: "emergency-calls",
									endpoint: `/v1/calls/${subPath}`,
									parametros: `city=${cityName}`,
									arquivo: `${filePrefix}.json`,
									formato: "JSON",
									numero_registros: countRecords(b2),
									status: "completo",
									observacao: "",
								});
							}
						} catch {
							addError(
								"emergency-calls",
								`/v1/calls/${subPath}`,
								`city=${cityName}`,
								"?",
								"Falha na requisição",
							);
						}
					}
				}
			}
		}
	} catch (err) {
		console.log("  Erro ao descobrir cidades:", String(err));
	}
}

// ─── Execução principal ───

async function main() {
	console.log("=== Exportação da Plataforma de Dados da Ameciclo ===\n");

	const startTime = new Date();

	// Criar estrutura de diretórios
	const pages = [
		"ciclodados",
		"contagens",
		"perfil_ciclista",
		"execucao_cicloviaria",
		"infracoes",
		"chamados_emergencia",
		"vias_inseguras",
		"sinistros_fatais",
		"orcamento_pernambuco",
		"orcamento_recife",
		"bicicletarios",
		"bike_pe",
		"ideciclo",
		"cms",
	];
	for (const p of pages) {
		ensureDir(join(OUTPUT_DIR, p));
	}

	const endpoints = buildEndpoints();
	console.log(`Endpoints definidos: ${endpoints.length}\n`);

	// Processar endpoints principais (com concorrência limitada)
	for (let i = 0; i < endpoints.length; i += CONCURRENCY) {
		const batch = endpoints.slice(i, i + CONCURRENCY);
		const promises = batch.map((def) =>
			fetchEndpoint(def).catch((err) => {
				addError(
					def.service,
					def.endpoint,
					JSON.stringify(def.params ?? {}),
					"exception",
					String(err),
				);
				console.log(`  [EXCEPTION] ${def.endpoint}: ${String(err)}`);
			}),
		);
		await Promise.all(promises);
	}

	// Endpoints paginados
	console.log("\n=== Endpoints com paginação ===\n");

	try {
		await fetchPaginatedCalls("chamados_emergencia");
	} catch (err) {
		addError(
			"emergency-calls",
			"/v1/calls (paginated)",
			"",
			"exception",
			String(err),
		);
		console.log(`  [EXCEPTION] paginated calls: ${String(err)}`);
	}

	try {
		await fetchPaginatedStreets("infracoes");
	} catch (err) {
		addError(
			"traffic-tickets",
			"/v1/streets (paginated)",
			"",
			"exception",
			String(err),
		);
		console.log(`  [EXCEPTION] paginated streets: ${String(err)}`);
	}

	// Endpoints parametrizados
	await fetchParametrizedEndpoints();

	// Serviços ausentes
	addError(
		"state-budget",
		"/v1/budget/state",
		"",
		"N/A",
		"Serviço não implementado (skeleton app sem src/)",
	);
	addError(
		"recife-budget",
		"/v1/budget/recife",
		"",
		"N/A",
		"Serviço não encontrado (diretório apps/recife-budget/ não existe)",
	);
	console.log("\n  state-budget: serviço ausente (skeleton)");
	console.log("  recife-budget: serviço ausente (não encontrado)");

	// Arquivo estático PCR_CONTAGENS
	try {
		const pcrPath = join(__dirname, "..", "dbs", "PCR_CONTAGENS.json");
		if (existsSync(pcrPath)) {
			const content = readFileSync(pcrPath, "utf-8");
			ensureDir(join(OUTPUT_DIR, "contagens"));
			writeFileSync(
				join(OUTPUT_DIR, "contagens/PCR_CONTAGENS.json"),
				content,
				"utf-8",
			);
			const parsed = JSON.parse(content);
			addIndex({
				tema: "contagens",
				servico: "arquivo-estatico",
				endpoint: "/dbs/PCR_CONTAGENS.json",
				parametros: "",
				arquivo: "contagens/PCR_CONTAGENS.json",
				formato: "JSON",
				numero_registros: countRecords(parsed),
				status: "completo",
				observacao: "Arquivo estático copiado do projeto",
			});
		}
	} catch (err) {
		console.log("  PCR_CONTAGENS.json não encontrado ou erro:", String(err));
	}

	// Gerar index.csv
	const indexCsv =
		"tema,servico,endpoint,parametros,arquivo,formato,numero_registros,status,observacao\n" +
		indexRows
			.map(
				(r) =>
					`${r.tema},${r.servico},${r.endpoint},${r.parametros},${r.arquivo},${r.formato},${r.numero_registros},${r.status},${r.observacao}`,
			)
			.join("\n") +
		"\n";
	writeFileSync(join(OUTPUT_DIR, "index.csv"), indexCsv, "utf-8");

	// Gerar errors.csv
	const errorsCsv =
		"servico,endpoint,parametros,status_http,erro,tentativa_realizada\n" +
		errorRows
			.map(
				(r) =>
					`${r.servico},${r.endpoint},${r.parametros},${r.status_http},"${r.erro.replace(/"/g, '""')}",${r.tentativa_realizada}`,
			)
			.join("\n") +
		"\n";
	writeFileSync(join(OUTPUT_DIR, "errors.csv"), errorsCsv, "utf-8");

	// Gerar README.md
	const endTime = new Date();
	const completedCount = indexRows.filter(
		(r) => r.status === "completo",
	).length;
	const partialCount = indexRows.filter((r) => r.status !== "completo").length;
	const fileCount = indexRows.length;
	const endpointCount = endpoints.length + 2; // +2 for paginated

	const readme = `# Exportação da Plataforma de Dados da Ameciclo

**Data da extração:** ${startTime.toISOString()}

## Resumo

- **Endpoints acessados:** ${endpointCount}
- **Arquivos gerados:** ${fileCount}
- **Bases completas:** ${completedCount}
- **Bases parciais:** ${partialCount}
- **Endpoints com falha:** ${errorRows.length}

## Endpoints que falharam

${
	errorRows.length > 0
		? errorRows
				.map((r) => `- \`${r.servico}${r.endpoint}\` — Erro: ${r.erro}`)
				.join("\n")
		: "Nenhum"
}

## Serviços ausentes

- **state-budget (porta 3017):** App skeleton — diretório \`apps/state-budget/\` não possui \`src/\`
- **recife-budget (porta 3018):** App não encontrado — diretório \`apps/recife-budget/\` não existe

## Estrutura de diretórios

\`\`\`
exports/ameciclo/
├── README.md
├── index.csv
├── errors.csv
├── ciclodados/
├── contagens/
├── perfil_ciclista/
├── execucao_cicloviaria/
├── infracoes/
├── chamados_emergencia/
├── vias_inseguras/
├── sinistros_fatais/
├── orcamento_pernambuco/
├── orcamento_recife/
├── bicicletarios/
├── bike_pe/
├── ideciclo/
└── cms/
\`\`\`

## Como executar novamente

\`\`\`bash
npx tsx scripts/export-ameciclo.ts
\`\`\`

**Pré-requisitos:** Todos os microsserviços devem estar rodando nas portas 3000–3050.

## Comando

\`\`\`bash
node /home/dvalenca/code/atlas/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/export-ameciclo.ts
\`\`\`
`;

	writeFileSync(join(OUTPUT_DIR, "README.md"), readme, "utf-8");

	console.log(`\n=== Concluído ===`);
	console.log(`Pasta de saída: ${OUTPUT_DIR}`);
	console.log(`Endpoints acessados: ~${endpointCount}`);
	console.log(`Arquivos gerados: ${fileCount}`);
	console.log(
		`Completos: ${completedCount} | Parciais: ${partialCount} | Erros: ${errorRows.length}`,
	);
	console.log(`Comando para repetir: npx tsx scripts/export-ameciclo.ts`);
}

main().catch((err) => {
	console.error("FATAL:", err);
	process.exit(1);
});
