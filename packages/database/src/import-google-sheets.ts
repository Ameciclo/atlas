import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

// ============================================================================
// TYPES
// ============================================================================

interface LegacyCountData {
	id: number;
	coordinates: {
		x: number; // longitude
		y: number; // latitude
	};
	metadata: {
		name: string;
		date: string;
		city: {
			id: number;
			name: string;
			state: string;
			full_state: string;
			rmr: boolean;
		};
		directions: Record<string, string>;
	};
	data: {
		sessions: Array<{
			session: string; // "06-07"
			start_time: string; // ISO
			end_time: string; // ISO
			total_cyclists: number;
			quantitative: {
				north_west: number;
				north_south: number;
				north_east: number;
				east_north: number;
				east_west: number;
				east_south: number;
				south_east: number;
				south_north: number;
				south_west: number;
				west_south: number;
				west_east: number;
				west_north: number;
			};
			characteristics: {
				cargo: number;
				helmet: number;
				juveniles: number;
				motor: number;
				other_active_modes: number;
				other_behaviors: number;
				others: number;
				rain: number;
				ride: number;
				service: number;
				shared_bike: number;
				sidewalk: number;
				women: number;
				wrong_way: number;
			};
		}>;
	};
}

interface ParsedSheet {
	url: string;
	sheetName: string;
	date: string; // YYYY-MM-DD
	intersectionName: string;
	lat: number;
	lon: number;
	total: number;
	maxHour: number;
	reportUrl: string;
	standardCharacteristics: Record<string, number[]>; // label -> array of 14 hourly counts
	observationalCharacteristics: Record<string, number[]>; // label -> array of 14 hourly counts
	directionLabels: string[]; // 4 unique origin labels
	movements: Array<{
		origin: string;
		destination: string;
		hourlyCounts: number[]; // 14 elements
		total: number;
	}>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CARDINAL_DIRECTIONS = ["north", "east", "south", "west"] as const;

const STANDARD_CHARACTERISTIC_MAP: Record<string, keyof LegacyCountData["data"]["sessions"][0]["characteristics"]> = {
	Mulher: "women",
	"Crianças e adolescentes": "juveniles",
	Capacete: "helmet",
	// Aggregate labels (used in older 2024 sheets)
	Caronas: "ride",
	Cargueiras: "cargo",
	Serviço: "service",
	Contramão: "wrong_way",
	Calçada: "sidewalk",
	// Sub-category labels (used in newer 2026 sheets)
	"Carona criança": "ride",
	"Carona mulher": "ride",
	"Carona homem": "ride",
	"Cargueira tradicional": "cargo",
	"Adaptada a carga": "cargo",
	"Serviço APP": "service",
	"Contramão para conversão": "wrong_way",
};

// Aggregated label keys that may be duplicated by sub-categories in the observational section.
// If these appear in the observational section, skip them to avoid double-counting.
const AGGREGATE_LABELS = new Set(["Caronas", "Cargueiras", "Serviço", "Contramão"]);

// Observational characteristics that map to additional fields
const OBSERVATIONAL_CHAR_MAP: Record<string, keyof LegacyCountData["data"]["sessions"][0]["characteristics"]> = {
	"Bike PE": "shared_bike",
	Empurrando: "other_active_modes",
	Triciclo: "other_active_modes",
	Carroça: "other_active_modes",
	Elétrica: "motor",
	Motorizada: "motor",
	Ciclomotor: "motor",
	"Skate e outros patináveis": "other_active_modes",
	Cadeirante: "other_active_modes",
	Handbike: "other_active_modes",
	"Grupos de Pedal": "other_behaviors",
	"Faixa Azul": "other_behaviors",
	Ciclofaixa: "other_behaviors",
	'"Outros"': "others",
	Outros: "others",
	Máscara: "others",
	Chuva: "rain",
};

// Cities with IBGE codes known from the data
const CITY_MAP: Record<string, { id: number; name: string; state: string; full_state: string; rmr: boolean }> = {
	Recife: { id: 2611606, name: "Recife", state: "PE", full_state: "Pernambuco", rmr: true },
	Olinda: { id: 2609600, name: "Olinda", state: "PE", full_state: "Pernambuco", rmr: true },
	Jaboatão: { id: 2607901, name: "Jaboatão", state: "PE", full_state: "Pernambuco", rmr: true },
	"Jaboatão dos Guararapes": { id: 2607901, name: "Jaboatão dos Guararapes", state: "PE", full_state: "Pernambuco", rmr: true },
	Camaragibe: { id: 2603454, name: "Camaragibe", state: "PE", full_state: "Pernambuco", rmr: true },
	Ipojuca: { id: 2607208, name: "Ipojuca", state: "PE", full_state: "Pernambuco", rmr: true },
	"Cabo de Santo Agostinho": { id: 2602902, name: "Cabo de Santo Agostinho", state: "PE", full_state: "Pernambuco", rmr: true },
	Itamaracá: { id: 2607604, name: "Itamaracá", state: "PE", full_state: "Pernambuco", rmr: true },
	Itapissuma: { id: 2607752, name: "Itapissuma", state: "PE", full_state: "Pernambuco", rmr: true },
	Igarassu: { id: 2606804, name: "Igarassu", state: "PE", full_state: "Pernambuco", rmr: true },
	"Abreu e Lima": { id: 2600054, name: "Abreu e Lima", state: "PE", full_state: "Pernambuco", rmr: true },
	Moreno: { id: 2609402, name: "Moreno", state: "PE", full_state: "Pernambuco", rmr: true },
	Paulista: { id: 2610707, name: "Paulista", state: "PE", full_state: "Pernambuco", rmr: true },
	"São Lourenço": { id: 2613701, name: "São Lourenço", state: "PE", full_state: "Pernambuco", rmr: true },
	"São Lourenço da Mata": { id: 2613701, name: "São Lourenço da Mata", state: "PE", full_state: "Pernambuco", rmr: true },
};

// ============================================================================
// HELPERS
// ============================================================================

function extractSheetId(url: string): string {
	const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
	if (!match?.[1]) throw new Error(`Invalid Google Sheets URL: ${url}`);
	return match[1];
}

function xlsxSerialToDate(serial: number): Date {
	// Excel serial date to JS Date
	// 25569 = days from 1900-01-01 to 1970-01-01 (accounting for Excel's 1900 leap year bug)
	const jsDateMs = (serial - 25569) * 86400 * 1000;
	return new Date(jsDateMs);
}

function formatDate(date: Date): string {
	// Use UTC methods to avoid timezone shift (Excel serials are midnight UTC)
	const y = date.getUTCFullYear();
	const m = String(date.getUTCMonth() + 1).padStart(2, "0");
	const d = String(date.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function formatSessionLabel(hour: number): string {
	const start = String(hour).padStart(2, "0");
	const end = String(hour + 1).padStart(2, "0");
	return `${start}-${end}`;
}

/**
 * Extract city from intersection name.
 * Some names have "| CityName" suffix. Others are assumed to be Recife.
 */
function extractCity(
	intersectionName: string,
): { id: number; name: string; state: string; full_state: string; rmr: boolean } {
	const pipeMatch = intersectionName.match(/\|\s*(.+)$/);
	if (pipeMatch?.[1]) {
		const cityName = pipeMatch[1].trim();
		const directCity = CITY_MAP[cityName];
		if (directCity) return directCity;
		// Try partial match
		for (const key of Object.keys(CITY_MAP)) {
			if (cityName.includes(key) || key.includes(cityName)) {
				const matched = CITY_MAP[key];
				if (matched) return matched;
			}
		}
		console.warn(`  ⚠ Unknown city "${cityName}" - defaulting to Recife`);
	}
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	return CITY_MAP["Recife"]!;
}

function cleanIntersectionName(name: string): string {
	return name
		// Remove "| City" suffix
		.replace(/\s*\|\s*.+$/, "")
		// Normalize abbreviations
		.replace(/\bAvenida\b/gi, "Av.")
		.replace(/\bRua\b(?!\s+[dD])/gi, "R.") // "Rua" → "R." but not "Rua Dr."
		.replace(/\bAv\b(?!\.)/gi, "Av.") // "Av " → "Av."
		// Normalize X separator
		.replace(/\s+X\s+/g, " x ")
		// Collapse multiple spaces
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Build the 14 hourly counts from movement rows and characteristic rows
 */
function buildSessions(
	movements: ParsedSheet["movements"],
	standardChars: ParsedSheet["standardCharacteristics"],
	observationalChars: ParsedSheet["observationalCharacteristics"],
	directionLabels: string[],
	dateStr: string,
): LegacyCountData["data"]["sessions"] {
	// directionLabels[0] -> north, [1] -> east, [2] -> south, [3] -> west
	const labelToCardinal: Record<string, string> = {};
	for (let i = 0; i < directionLabels.length && i < CARDINAL_DIRECTIONS.length; i++) {
		labelToCardinal[directionLabels[i]!] = CARDINAL_DIRECTIONS[i] as string;
	}

	const sessions: LegacyCountData["data"]["sessions"] = [];

	for (let hour = 6; hour <= 19; hour++) {
		const hourIdx = hour - 6; // 0-based index into 14-element arrays

		const sessionStart = new Date(`${dateStr}T${String(hour).padStart(2, "0")}:00:00`);
		const sessionEnd = new Date(`${dateStr}T${String(hour + 1).padStart(2, "0")}:00:00`);

		// Calculate total cyclists for this hour from movement rows
		let totalCyclists = 0;
		const quantMap: Record<string, number> = {};

		for (const mov of movements) {
			const count = mov.hourlyCounts[hourIdx] || 0;
			totalCyclists += count;

			const fromCardinal = labelToCardinal[mov.origin];
			const toCardinal = labelToCardinal[mov.destination];
			if (fromCardinal && toCardinal) {
				const key = `${fromCardinal}_${toCardinal}`;
				quantMap[key] = (quantMap[key] || 0) + count;
			}
		}

		// Build quantitative
		const quantitative: LegacyCountData["data"]["sessions"][0]["quantitative"] = {
			north_west: 0,
			north_south: 0,
			north_east: 0,
			east_north: 0,
			east_west: 0,
			east_south: 0,
			south_east: 0,
			south_north: 0,
			south_west: 0,
			west_south: 0,
			west_east: 0,
			west_north: 0,
		};

		for (const [key, val] of Object.entries(quantMap)) {
			if (key in quantitative) {
				(quantitative as Record<string, number>)[key] = val;
			}
		}

		// Build characteristics
		const chars: Record<string, number> = {
			cargo: 0,
			helmet: 0,
			juveniles: 0,
			motor: 0,
			other_active_modes: 0,
			other_behaviors: 0,
			others: 0,
			rain: 0,
			ride: 0,
			service: 0,
			shared_bike: 0,
			sidewalk: 0,
			women: 0,
			wrong_way: 0,
		};

		// Map standard characteristics
		for (const [label, hourlyCounts] of Object.entries(standardChars)) {
			const mapped = STANDARD_CHARACTERISTIC_MAP[label];
			if (mapped) {
				const current = (chars as Record<string, number>)[mapped] ?? 0;
				(chars as Record<string, number>)[mapped] = Math.round(current + (hourlyCounts[hourIdx] ?? 0));
			}
		}

		// Map observational characteristics (skip aggregate labels already handled in standard section)
		for (const [label, hourlyCounts] of Object.entries(observationalChars)) {
			const count = hourlyCounts[hourIdx] || 0;
			if (count === 0) continue;

			// Skip aggregate labels that duplicate sub-category sums from standard section
			if (AGGREGATE_LABELS.has(label) && standardChars[label] === undefined) {
				const mapped = STANDARD_CHARACTERISTIC_MAP[label];
				if (mapped) {
					const current = (chars as Record<string, number>)[mapped] ?? 0;
					(chars as Record<string, number>)[mapped] = Math.round(current + count);
				}
				continue;
			}

			if (AGGREGATE_LABELS.has(label)) {
				continue;
			}

			const mapped = STANDARD_CHARACTERISTIC_MAP[label] || OBSERVATIONAL_CHAR_MAP[label];
			if (mapped) {
				const current = (chars as Record<string, number>)[mapped] ?? 0;
				(chars as Record<string, number>)[mapped] = Math.round(current + count);
			}
		}

		sessions.push({
			session: formatSessionLabel(hour),
			start_time: sessionStart.toISOString(),
			end_time: sessionEnd.toISOString(),
			total_cyclists: totalCyclists,
			quantitative,
			characteristics: chars as LegacyCountData["data"]["sessions"][0]["characteristics"],
		});
	}

	return sessions;
}

// ============================================================================
// XLSX PARSING
// ============================================================================

function parseResumo(workbook: XLSX.WorkBook): {
	intersectionName: string;
	date: string;
	lat: number;
	lon: number;
	total: number;
	maxHour: number;
	reportUrl: string;
} {
	const sheet = workbook.Sheets["Resumo"];
	if (!sheet) throw new Error("Resumo tab not found");

	const data = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
		header: 1,
		defval: "",
	});

	const intersectionName = String(data[0]?.[1] || "");
	const dateSerial = Number(data[1]?.[1]);
	const coords = String(data[2]?.[1] || "").split(",");
	const lat = parseFloat(coords[0]?.trim() || "0");
	const lon = parseFloat(coords[1]?.trim() || "0");
	const reportUrl = String(data[3]?.[1] || "");
	const total = Math.round(Number(data[4]?.[1]) || 0);
	const maxHour = Math.round(Number(data[5]?.[1]) || 0);

	// Rows 6-13 have characteristic fractions
	// But we get actual counts from the Dados tab; fractions are just for verification

	const date = formatDate(xlsxSerialToDate(dateSerial));

	return { intersectionName, date, lat, lon, total, maxHour, reportUrl };
}

function parseDados(workbook: XLSX.WorkBook): {
	directionLabels: string[];
	movements: ParsedSheet["movements"];
	standardCharacteristics: Record<string, number[]>;
	observationalCharacteristics: Record<string, number[]>;
} {
	const sheet = workbook.Sheets["Dados"];
	if (!sheet) throw new Error("Dados tab not found");

	const data = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
		header: 1,
		defval: "",
	});

	// Detect column offset
	const headerRow = data[1];
	let colOffset = 0;
	if (headerRow) {
		if (String(headerRow[0] || "").trim() === "ORIGEM") {
			colOffset = 0;
		} else if (String(headerRow[1] || "").trim() === "ORIGEM") {
			colOffset = 1;
		} else {
			for (let c = 0; c < headerRow.length; c++) {
				if (String(headerRow[c] || "").trim() === "ORIGEM") {
					colOffset = c;
					break;
				}
			}
		}
	}

	const originCol = colOffset;
	const destCol = colOffset + 1;
	const hourStartCol = colOffset + 2;
	const hourEndCol = hourStartCol + 13; // 14 hours (6-19)
	const totalCol = hourEndCol + 1; // TOTAL column

	// Parse movements from rows (skipping header rows)
	const movements: ParsedSheet["movements"] = [];
	const directionLabels: string[] = [];

	for (let i = 2; i < data.length; i++) {
		const row = data[i];
		if (!row) continue;

		const origin = String(row[originCol] || "").trim();
		const destination = String(row[destCol] || "").trim();

		if (!origin || !destination) continue;
		// Stop when we hit the total row or section header
		if (origin.toLowerCase() === "total" || origin.includes("Dados qualitativos")) break;

		if (!directionLabels.includes(origin)) directionLabels.push(origin);
		if (!directionLabels.includes(destination)) directionLabels.push(destination);

		const hourlyCounts: number[] = [];
		for (let h = hourStartCol; h <= hourEndCol; h++) {
			hourlyCounts.push(Math.round(Number(row[h]) || 0));
		}

		const total = Math.round(Number(row[totalCol]) || 0);
		movements.push({ origin, destination, hourlyCounts, total });
	}

	// Scan ALL rows for characteristic data
	// Standard vs observational split: tracks whether we've passed the "observações" header
	const standardCharacteristics: Record<string, number[]> = {};
	const observationalCharacteristics: Record<string, number[]> = {};
	let inObservational = false;

	for (let i = 0; i < data.length; i++) {
		const rawRow = data[i];
		if (!rawRow) continue;

		// Convert row entries to strings for safe comparison
		const row = rawRow.map((c) => (c === undefined ? "" : String(c)));

		const label = row[destCol]?.trim() || "";
		const fullFirstCell = (row[colOffset]?.trim() || "") + (row[colOffset + 1]?.trim() || "");

		// Track section boundaries
		if (fullFirstCell.includes("Dados qualitativos das observa")) {
			inObservational = true;
			continue;
		}
		if (fullFirstCell.includes("Dados qualitativos padr")) {
			inObservational = false;
			continue;
		}

		// Skip non-characteristic rows
		if (!label || label === "") continue;
		if (label.toLowerCase() === "característica") continue;
		if (label.toLowerCase() === "origem" || label.toLowerCase() === "destino") continue;
		if (label.toLowerCase() === "total" || label.toLowerCase() === "percentual") continue;
		// Skip movement data rows (labels that look like origin/destination names - they're part of movement rows)
		if (directionLabels.includes(label)) continue;
		// Skip numeric-only labels (totals or garbage)
		if (/^\d+(\.\d+)?$/.test(label) || label === "0") continue;

		// Parse hourly counts
		const hourlyCounts: number[] = [];
		for (let h = hourStartCol; h <= hourEndCol; h++) {
			hourlyCounts.push(Math.round(Number(rawRow[h]) || 0));
		}

		if (inObservational) {
			observationalCharacteristics[label] = hourlyCounts;
		} else {
			standardCharacteristics[label] = hourlyCounts;
		}
	}

	return { directionLabels, movements, standardCharacteristics, observationalCharacteristics };
}

function transformToLegacy(sheetData: ParsedSheet, id: number): LegacyCountData {
	const city = extractCity(sheetData.intersectionName);
	const cleanName = cleanIntersectionName(sheetData.intersectionName);

	// Map direction labels to cardinal directions
	const directions: Record<string, string> = {};
	sheetData.directionLabels.forEach((label, i) => {
		if (i < CARDINAL_DIRECTIONS.length) {
			directions[CARDINAL_DIRECTIONS[i] as string] = label;
		}
	});

	const sessions = buildSessions(
		sheetData.movements,
		sheetData.standardCharacteristics,
		sheetData.observationalCharacteristics,
		sheetData.directionLabels,
		sheetData.date,
	);

	return {
		id,
		coordinates: {
			x: sheetData.lon,
			y: sheetData.lat,
		},
		metadata: {
			name: cleanName,
			date: sheetData.date,
			city,
			directions,
		},
		data: {
			sessions,
		},
	};
}

// ============================================================================
// MAIN
// ============================================================================

// ============================================================================
// MASTER LIST & CACHE
// ============================================================================

const MASTER_SHEET_URL =
	process.env.CYCLIST_COUNTS_MASTER_SHEET_URL ||
	"https://docs.google.com/spreadsheets/d/1DKQD7I4YASwCh63RyKDfU0VkHTrZ9JBGPnnf6tyk5ZU/edit?gid=1371025004#gid=1371025004";

const CACHE_DIR = (() => {
	const envCache = process.env.CYCLIST_COUNTS_CACHE_DIR;
	const base = fileURLToPath(new URL(".", import.meta.url));
	if (envCache) return join(base, "../seed-data/cyclist-counts", envCache);
	return join(base, "../seed-data/cyclist-counts/cache");
})();

function parseArgs(): { force: boolean; noDownload: boolean } {
	const args = process.argv.slice(2);
	return {
		force: args.includes("--force"),
		noDownload: args.includes("--no-download"),
	};
}

async function fetchMasterSheetUrls(): Promise<string[]> {
	console.log("📋 Fetching master list from spreadsheet...");

	// Parse the master sheet URL to get sheet ID and gid
	const idMatch = MASTER_SHEET_URL.match(/\/d\/([a-zA-Z0-9_-]+)/);
	const gidMatch = MASTER_SHEET_URL.match(/gid=(\d+)/);
	if (!idMatch?.[1]) throw new Error("Invalid master sheet URL");
	const masterSheetId = idMatch[1];
	const masterGid = gidMatch?.[1] || "0";

	const exportUrl = `https://docs.google.com/spreadsheets/d/${masterSheetId}/export?format=csv&gid=${masterGid}`;
	const response = await fetch(exportUrl);
	if (!response.ok) throw new Error(`Failed to fetch master list: HTTP ${response.status}`);
	const csvText = await response.text();

	const urls: string[] = [];
	const lines = csvText.split("\n");
	if (lines.length < 2) throw new Error("Master list is empty");

	const header = lines[0]!.split(",");
	const linkColIdx = header.findIndex((h) => h.trim() === "Link" || h.trim() === '"Link"');
	if (linkColIdx < 0) throw new Error("'Link' column not found in master list");

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i]!.trim();
		if (!line) continue;

		// Parse CSV properly for quoted fields
		const cells: string[] = [];
		let current = "";
		let inQuotes = false;
		for (let j = 0; j < line.length; j++) {
			const ch = line[j];
			if (ch === '"') {
				if (inQuotes && j + 1 < line.length && line[j + 1] === '"') {
					current += '"';
					j++;
				} else {
					inQuotes = !inQuotes;
				}
			} else if (ch === "," && !inQuotes) {
				cells.push(current);
				current = "";
			} else {
				current += ch;
			}
		}
		cells.push(current);

		const link = cells[linkColIdx]?.trim();
		if (link && link.includes("docs.google.com/spreadsheets")) {
			urls.push(link.replace(/(\#gid=.*)?$/, "").replace(/\/$/, ""));
		}
	}

	console.log(`   Found ${urls.length} spreadsheet URLs\n`);
	return urls;
}

function getCachePath(sheetId: string): string {
	return join(CACHE_DIR, `${sheetId}.xlsx`);
}

async function loadXlsxFromCacheOrDownload(sheetId: string, force: boolean, noDownload: boolean): Promise<XLSX.WorkBook> {
	const cachePath = getCachePath(sheetId);

	// Use cache if it exists and we're not forcing re-download
	if (existsSync(cachePath) && !force) {
		const buf = readFileSync(cachePath);
		return XLSX.read(buf, { type: "buffer" });
	}

	if (noDownload) {
		throw new Error(`Not downloaded and --no-download is set: ${sheetId}`);
	}

	// Download
	const downloadUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
	const response = await fetch(downloadUrl);
	if (!response.ok) {
		throw new Error(`Failed to download sheet ${sheetId}: HTTP ${response.status}`);
	}
	const buffer = Buffer.from(await response.arrayBuffer());

	// Save to cache
	if (!existsSync(CACHE_DIR)) {
		mkdirSync(CACHE_DIR, { recursive: true });
	}
	writeFileSync(cachePath, buffer);

	return XLSX.read(buffer, { type: "buffer" });
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
	const args = parseArgs();

	console.log("🚲 Google Sheets Importer - Cyclist Counts\n");
	console.log(`📋 Master sheet: ${MASTER_SHEET_URL}`);
	console.log(`💾 Cache dir: ${CACHE_DIR}`);
	console.log(`⚙ Flags: force=${args.force}, noDownload=${args.noDownload}\n`);

	// Fetch list of all spreadsheet URLs from master sheet
	const urls = await fetchMasterSheetUrls();

	console.log(`📊 Processing ${urls.length} spreadsheets...\n`);

	const results: LegacyCountData[] = [];
	const errors: string[] = [];
	let downloaded = 0;
	let fromCache = 0;

	for (let i = 0; i < urls.length; i++) {
		const url = urls[i]!;
		const sheetId = extractSheetId(url);
		const shortId = sheetId.substring(0, 8);
		const cachePath = getCachePath(sheetId);
		const cached = existsSync(cachePath) && !args.force;
		const status = cached ? "📦 cache" : args.noDownload ? "⏭ skip" : "⬇ download";

		console.log(`[${i + 1}/${urls.length}] ${status} ${shortId}...`);

		if (args.noDownload && !cached) {
			errors.push(`${sheetId}: Not in cache (--no-download)`);
			continue;
		}

		try {
			const workbook = await loadXlsxFromCacheOrDownload(sheetId, args.force, args.noDownload);
			if (cached) fromCache++;
			else downloaded++;

			// Parse Resumo tab
			const resumo = parseResumo(workbook);
			console.log(`  ✓ Resumo: "${resumo.intersectionName}" | ${resumo.date} | ${resumo.total} cyclists`);

			// Parse Dados tab
			const dados = parseDados(workbook);
			console.log(`  ✓ Dados: ${dados.movements.length} movement rows, ${dados.directionLabels.length} directions`);
			if (Object.keys(dados.standardCharacteristics).length > 0) {
				console.log(`     Std chars: ${Object.keys(dados.standardCharacteristics).join(", ")}`);
			}

			const parsed: ParsedSheet = {
				url,
				sheetName: resumo.intersectionName,
				date: resumo.date,
				intersectionName: resumo.intersectionName,
				lat: resumo.lat,
				lon: resumo.lon,
				total: resumo.total,
				maxHour: resumo.maxHour,
				reportUrl: resumo.reportUrl,
				standardCharacteristics: dados.standardCharacteristics,
				observationalCharacteristics: dados.observationalCharacteristics,
				directionLabels: dados.directionLabels,
				movements: dados.movements,
			};

			// Transform to legacy format
			const legacy = transformToLegacy(parsed, i + 1);

			// Validate: check total matches
			const computedTotal = legacy.data.sessions.reduce((s, sess) => s + sess.total_cyclists, 0);
			console.log(`  📐 Session total: ${computedTotal} (Resumo total: ${resumo.total})`);

			if (computedTotal !== resumo.total) {
				console.warn(`  ⚠ Mismatch! Computed=${computedTotal}, Expected=${resumo.total}`);
			}

			results.push(legacy);
			console.log("");
		} catch (err) {
			const msg = `  ❌ Error: ${err instanceof Error ? err.message : String(err)}`;
			console.log(msg);
			errors.push(`${sheetId}: ${err instanceof Error ? err.message : String(err)}`);
		}

		// Small delay to avoid rate limiting
		if (i < urls.length - 1) {
			await new Promise((r) => setTimeout(r, 300));
		}
	}

	// Save results
	const outputPath = join(fileURLToPath(new URL(".", import.meta.url)), "../seed-data/cyclist-counts/imported-data.json");
	writeFileSync(outputPath, JSON.stringify(results, null, "\t"), "utf-8");
	console.log(`\n📁 Saved ${results.length} events to ${outputPath}`);

	console.log(`\n💾 Cache stats: ${downloaded} downloaded, ${fromCache} from cache`);

	if (errors.length > 0) {
		console.log(`\n❌ ${errors.length} errors:`);
		for (const err of errors) {
			console.log(`  - ${err}`);
		}
	}

	// Print summary
	console.log("\n📊 SUMMARY");
	console.log(`   Total events: ${results.length}`);
	const totalCyclists = results.reduce((s, r) => s + r.data.sessions.reduce((ss, sess) => ss + sess.total_cyclists, 0), 0);
	console.log(`   Total cyclists: ${totalCyclists}`);

	const cities = new Set(results.map((r) => r.metadata.city.name));
	console.log(`   Cities: ${[...cities].join(", ")}`);

	const dates = results.map((r) => r.metadata.date).sort();
	if (dates.length > 0) {
		console.log(`   Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
	}
}

main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
