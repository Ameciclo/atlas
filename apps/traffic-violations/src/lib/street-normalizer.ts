export interface NormalizedLocation {
	raw: string;
	cleaned: string;
	streetType: string | null;
	streetName: string | null;
	fullStreet: string | null;
	semaphoreNumber: string | null;
	addressNumber: string | null;
	postNumber: string | null;
	reference: string | null;
	direction: string | null;
}

const STREET_TYPE_MAP: Record<string, string> = {
	RUA: "RUA",
	"R.": "RUA",
	"RUA.": "RUA",
	AVENIDA: "AVENIDA",
	"AV.": "AVENIDA",
	AV: "AVENIDA",
	PRACA: "PRACA",
	"PRC.": "PRACA",
	PRC: "PRACA",
	ESTRADA: "ESTRADA",
	"ESTR.": "ESTRADA",
	TRAVESSA: "TRAVESSA",
	"TRAV.": "TRAVESSA",
	CORREGO: "CORREGO",
	PONTE: "PONTE",
	VIADUTO: "VIADUTO",
	LARGO: "LARGO",
	BECO: "BECO",
	ALAMEDA: "ALAMEDA",
	CANAL: "CANAL",
	RODOVIA: "RODOVIA",
};

const EXPANDED_ABBREVIATIONS: Record<string, string> = {
	"AV.": "AVENIDA",
	AV: "AVENIDA",
	"R.": "RUA",
	"PRC.": "PRACA",
	"ESTR.": "ESTRADA",
	"TRAV.": "TRAVESSA",
	"DR.": "DOUTOR",
	DR: "DOUTOR",
	"DRA.": "DOUTORA",
	"PROF.": "PROFESSOR",
	PROF: "PROFESSOR",
	"ENG.": "ENGENHEIRO",
	ENG: "ENGENHEIRO",
	"DES.": "DESEMBARGADOR",
	DES: "DESEMBARGADOR",
	"SEN.": "SENADOR",
	SEN: "SENADOR",
	"GOV.": "GOVERNADOR",
	GOV: "GOVERNADOR",
	"CEL.": "CORONEL",
	CEL: "CORONEL",
	"GEN.": "GENERAL",
	GEN: "GENERAL",
	"GAL.": "GENERAL",
	GAL: "GENERAL",
	"MAL.": "MARECHAL",
	MAL: "MARECHAL",
	"MIN.": "MINISTRO",
	MIN: "MINISTRO",
	"DEP.": "DEPUTADO",
	DEP: "DEPUTADO",
	"PREF.": "PREFEITO",
	PREF: "PREFEITO",
	"PRES.": "PRESIDENTE",
	PRES: "PRESIDENTE",
	"COM.": "COMENDADOR",
	COM: "COMENDADOR",
	"MAJ.": "MAJOR",
	MAJ: "MAJOR",
	"CAP.": "CAPITAO",
	CAP: "CAPITAO",
	"TEN.": "TENENTE",
	TEN: "TENENTE",
	"PAD.": "PADRE",
	PAD: "PADRE",
};

const DIRECTION_PATTERNS = [
	/\s+SENTIDO\s+SUBURBIO\s*$/i,
	/\s+SENTIDO\s+PRAIA\s*$/i,
	/\s+SENTIDO\s+UNICO\s*$/i,
	/\s+SENTIDO\s+CID\/SUB\s*$/i,
	/\s+SENTIDO\s+SUB\/CID\s*$/i,
	/\s+SENTIDO\s+CIDADE\/SUBURBIO\s*$/i,
	/\s+SENTIDO\s+SUBURBIO\/CIDADE\s*$/i,
	/\s+SENTIDONORTE\s*$/i,
	/\s+SENTIDO\s+NORTE\s*$/i,
	/\s+SENTIDO\s+SUL\s*$/i,
	/\s+SENTIDO\s+UNICO\b/i,
	/\s+SENTIDO\s+SUBURBIO\s+CIDADE\s*$/i,
	/\s+SENTIDO\s+CID\.?\s*$/i,
	/\s+SENTIDO\s+SUB\.?\s*$/i,
];

function removeAccents(str: string): string {
	return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function expandAbbreviations(text: string): string {
	let result = text;
	for (const [abbr, expanded] of Object.entries(EXPANDED_ABBREVIATIONS)) {
		const regex = new RegExp(`\\b${abbr.replace(".", "\\.")}(?=\\s|$)`, "gi");
		result = result.replace(regex, expanded);
	}
	return result;
}

function extractSemaphoreNumber(text: string): string | null {
	const patterns = [
		/SEMAFORO\s+(?:N\.?|NR\.?|NUMERO|DE\s+NUMERO)\s*(\d+)/i,
		/SEMAFORO\s+N\.?\s*(\d+)/i,
		/SEMAFORO\s+NR\s*(\d+)/i,
	];
	for (const pattern of patterns) {
		const match = text.match(pattern);
		if (match) return match[1] ?? null;
	}
	return null;
}

function extractAddressNumber(text: string): string | null {
	const landmarkPart = text.replace(/^[^,]*,\s*/, "");
	const patterns = [
		/(?:N\.?|NR\.?|NUMERO|N\s*-\s*)\s*(\d+)/i,
		/EM\s+FRENTE\s+AO\s+(?:N\.?|NR\.?)?\s*(\d+)/i,
		/DEFRONTE\s+(?:DO\s+)?(?:N\.?|NR\.?)?\s*(\d+)/i,
		/AO\s+LADO\s+AO\s+(?:N\.?|NR\.?)?\s*(\d+)/i,
	];
	for (const pattern of patterns) {
		const match = landmarkPart.match(pattern);
		if (match) return match[1] ?? null;
	}
	return null;
}

function extractPostNumber(text: string): string | null {
	const patterns = [
		/POSTE\s+(?:N\.?|NR\.?|NUMERO|DE\s+ILUMINACAO\s+PUBLICA\s+N\.?)\s*([A-Z]?\d+)/i,
		/POSTE\s+(?:DE\s+)?(?:ILUMINACA[OÇ]?\s*(?:PUBLICA\s*)?)?(?:N\.?\s*)?([A-Z]?\d{5,})/i,
		/DEFRONTE\s+DO\s+(?:POSTE\s+)?(?:N\.?|NR\.?)\s*([A-Z]?\d+)/i,
	];
	for (const pattern of patterns) {
		const match = text.match(pattern);
		if (match) return match[1] ?? null;
	}
	return null;
}

function extractDirection(text: string): string | null {
	for (const pattern of DIRECTION_PATTERNS) {
		const match = text.match(pattern);
		if (match) return (match[0] ?? "").trim() || null;
	}
	return null;
}

function extractReference(text: string): string | null {
	const landmarkPart = text.replace(/^[^,]+,\s*/, "");
	const refPatterns = [
		/(?:REF|PONTO\s+DE\s+REF)\s+(.+?)(?:\s+SENTIDO|\s*$)/i,
		/(?:EM\s+FRENTE\s+(?:AO|A)\s+|AO\s+LADO\s+(?:AO\s+)?)(.+?)(?:\s+SENTIDO|\s*$)/i,
	];
	for (const pattern of refPatterns) {
		const match = landmarkPart.match(pattern);
		if (match) {
			const ref = (match[1] ?? "").trim();
			if (ref && !/^\d/.test(ref) && ref.length > 3) return ref;
		}
	}
	return null;
}

function cleanStreetPrefix(text: string): string {
	let cleaned = text.toUpperCase().trim();

	// Remove double street prefixes like "RUA AVENIDA" -> "AVENIDA"
	cleaned = cleaned.replace(/^(RUA)\s+(AVENIDA)\s+/i, "$2 ");
	cleaned = cleaned.replace(/^(RUA)\s+(RUA)\s+/i, "$2 ");
	cleaned = cleaned.replace(/^(RUA)\s+(PRACA)\s+/i, "$2 ");
	cleaned = cleaned.replace(/^(RUA)\s+(TRAVESSA)\s+/i, "$2 ");
	cleaned = cleaned.replace(/^(RUA)\s+(ESTRADA)\s+/i, "$2 ");
	cleaned = cleaned.replace(/^(AVENIDA)\s+(AV\.?)\s+/i, "AVENIDA ");
	cleaned = cleaned.replace(/^(PRACA)\s+(PRC\.?)\s+/i, "PRACA ");

	// Remove leading "RUA " if followed by another street type
	cleaned = cleaned.replace(
		/^RUA\s+(AVENIDA|PRACA|TRAVESSA|ESTRADA|RUA)\b/i,
		"$1",
	);

	return cleaned.trim();
}

function extractStreetParts(text: string): {
	streetType: string | null;
	streetName: string | null;
} {
	const cleaned = cleanStreetPrefix(text);

	// Try to match known street types
	const typeRegex =
		/^(RUA|AVENIDA|PRACA|ESTRADA|TRAVESSA|CORREGO|PONTE|VIADUTO|LARGO|BECO|ALAMEDA|CANAL|RODOVIA)\s+/i;
	const typeMatch = cleaned.match(typeRegex);

	if (typeMatch && typeMatch[0]) {
		const type = (typeMatch[1] ?? "").toUpperCase();
		const normalizedType = STREET_TYPE_MAP[type] || type;
		const rest = cleaned.slice(typeMatch[0].length).trim();

		// Split at first separator to get pure street name
		const nameEnd = rest.search(
			/\s*(?:,|SEMAFORO|POSTE|DEFRONTE|SENTIDO|EM\s+FRENTE|SOB\s+O|AO\s+LADO|LADO\s+OPOSTO|NO\s+SEMAFORO|APOS|ANTES|PROXIMO|JUNTO|PONTO\s+DE|REF\s)/i,
		);
		const streetName =
			nameEnd >= 0 ? rest.slice(0, nameEnd).trim() : rest.trim();

		return {
			streetType: normalizedType,
			streetName: streetName || null,
		};
	}

	// No recognized street type prefix; try to extract any proper name
	// Handle cases like "C DA DETENCAO" -> extract full name as-is
	const firstComma = cleaned.indexOf(",");
	const namePart =
		firstComma >= 0 ? cleaned.slice(0, firstComma).trim() : cleaned;
	const nameEnd = namePart.search(
		/\s+(?:SEMAFORO|POSTE|DEFRONTE|SENTIDO|EM\s+FRENTE)/i,
	);

	const extractedName =
		nameEnd >= 0 ? namePart.slice(0, nameEnd).trim() : namePart;

	return {
		streetType: null,
		streetName: extractedName || null,
	};
}

export function normalizeLocation(raw: string): NormalizedLocation {
	const rawUpper = raw.toUpperCase().trim();

	// Expand known abbreviations
	const expanded = expandAbbreviations(rawUpper);

	// Remove direction suffixes for street name extraction
	const direction = extractDirection(expanded);
	let textWithoutDirection = expanded;
	if (direction) {
		textWithoutDirection = expanded
			.slice(0, expanded.lastIndexOf(direction))
			.trim();
	}

	// Extract street parts from the text
	const { streetType, streetName } = extractStreetParts(textWithoutDirection);

	// Extract landmarks
	const semaphoreNumber = extractSemaphoreNumber(expanded);
	const addressNumber = extractAddressNumber(expanded);
	const postNumber = extractPostNumber(expanded);
	const reference = extractReference(expanded);

	// Build clean full street name
	let fullStreet: string | null = null;
	if (streetType && streetName) {
		fullStreet = `${streetType} ${streetName}`;
	} else if (streetName) {
		fullStreet = streetName;
	}

	// Clean the raw text (remove double spaces, fix punctuation)
	const cleaned = rawUpper
		.replace(/\s+/g, " ")
		.replace(/\s*,\s*/g, ", ")
		.replace(/\s*\.\s*/g, ". ")
		.trim();

	return {
		raw,
		cleaned,
		streetType,
		streetName,
		fullStreet,
		semaphoreNumber,
		addressNumber,
		postNumber,
		reference,
		direction,
	};
}

export function normalizeStreetName(name: string): string {
	const upper = removeAccents(name.toUpperCase().trim());
	const expanded = expandAbbreviations(upper);
	const cleaned = cleanStreetPrefix(expanded);

	return cleaned.replace(/\s+/g, " ").trim();
}
