import { normalizeStreetName } from "./street-normalizer.js";

export interface StreetRecord {
  code: number;
  nameConcatenated: string;
  officialName: string;
  shortName: string;
  neighborhoodCode: number | null;
  neighborhoodName: string | null;
}

export interface MatchCandidate {
  street: StreetRecord;
  score: number;
  method: MatchMethod;
}

export type MatchMethod =
  | "exact_code"
  | "exact_name"
  | "exact_normalized"
  | "levenshtein"
  | "trigram"
  | "semaphore_lookup"
  | "reverse_geocode"
  | "neighborhood_disambiguate"
  | "manual";

export interface MatchResult {
  matched: boolean;
  candidates: MatchCandidate[];
  method: MatchMethod | null;
  confidence: number;
}

/**
 * Computes Levenshtein edit distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  let prevRow = new Array(n + 1);
  for (let j = 0; j <= n; j++) prevRow[j] = j;

  for (let i = 1; i <= m; i++) {
    const currRow = new Array(n + 1);
    currRow[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        currRow[j - 1] + 1,
        prevRow[j] + 1,
        prevRow[j - 1] + cost,
      );
    }
    prevRow = currRow;
  }

  return prevRow[n];
}

/**
 * Normalized Levenshtein similarity ratio (0 to 1).
 */
export function levenshteinSimilarity(a: string, b: string): number {
  const dist = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}

/**
 * Simple trigram similarity for in-memory use (no PG dependency).
 * Splits both strings into 3-character chunks and computes Jaccard.
 */
export function trigramSimilarity(a: string, b: string): number {
  const trigramsA = trigrams(a);
  const trigramsB = trigrams(b);

  if (trigramsA.size === 0 && trigramsB.size === 0) return 1;
  if (trigramsA.size === 0 || trigramsB.size === 0) return 0;

  const intersection = new Set(
    [...trigramsA].filter((t) => trigramsB.has(t)),
  );
  const union = new Set([...trigramsA, ...trigramsB]);

  return intersection.size / union.size;
}

function trigrams(str: string): Set<string> {
  const padded = `  ${str} `;
  const result = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) {
    result.add(padded.slice(i, i + 3));
  }
  return result;
}

/**
 * Attempts exact match between normalized extracted name and street official name.
 */
export function matchExactName(
  extractedName: string,
  streets: StreetRecord[],
): MatchCandidate[] {
  const normalized = normalizeStreetName(extractedName);
  if (!normalized || normalized.length < 3) return [];

  const candidates: MatchCandidate[] = [];

  for (const street of streets) {
    const officialNorm = normalizeStreetName(street.officialName);
    const concatNorm = normalizeStreetName(street.nameConcatenated);
    const shortNorm = normalizeStreetName(street.shortName);

    if (
      normalized === officialNorm ||
      normalized === concatNorm ||
      normalized === shortNorm
    ) {
      candidates.push({ street, score: 1.0, method: "exact_normalized" });
    }
  }

  return candidates;
}

/**
 * Attempts fuzzy match using Levenshtein similarity against street names.
 */
export function matchLevenshtein(
  extractedName: string,
  streets: StreetRecord[],
  threshold = 0.80,
): MatchCandidate[] {
  const normalized = normalizeStreetName(extractedName);
  if (!normalized || normalized.length < 3) return [];

  const candidates: MatchCandidate[] = [];

  for (const street of streets) {
    const officialNorm = normalizeStreetName(street.officialName);
    const sim = levenshteinSimilarity(normalized, officialNorm);

    if (sim >= threshold) {
      candidates.push({
        street,
        score: sim,
        method: "levenshtein",
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

/**
 * Attempts fuzzy match using trigram similarity against street names.
 */
export function matchTrigram(
  extractedName: string,
  streets: StreetRecord[],
  threshold = 0.35,
): MatchCandidate[] {
  const normalized = normalizeStreetName(extractedName);
  if (!normalized || normalized.length < 3) return [];

  const candidates: MatchCandidate[] = [];

  for (const street of streets) {
    const officialNorm = normalizeStreetName(street.officialName);
    const sim = trigramSimilarity(normalized, officialNorm);

    if (sim >= threshold) {
      candidates.push({
        street,
        score: sim,
        method: "trigram",
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

/**
 * Hybrid match: tries Levenshtein first, falls back to trigram.
 */
export function matchHybridFuzzy(
  extractedName: string,
  streets: StreetRecord[],
): MatchCandidate[] {
  const levCandidates = matchLevenshtein(extractedName, streets, 0.80);
  if (levCandidates.length > 0) return levCandidates;

  return matchTrigram(extractedName, streets, 0.30);
}

/**
 * Tries to disambiguate by neighborhood name when there are multiple candidates.
 */
export function disambiguateByNeighborhood(
  candidates: MatchCandidate[],
  neighborhoodHint: string | null,
): MatchCandidate[] {
  if (!neighborhoodHint || candidates.length <= 1) return candidates;

  const nhNorm = normalizeStreetName(neighborhoodHint);

  const boosted = candidates.map((c) => {
    if (c.street.neighborhoodName) {
      const streetNh = normalizeStreetName(c.street.neighborhoodName);
      if (streetNh === nhNorm) {
        return { ...c, score: c.score * 1.15 };
      }
    }
    return c;
  });

  return boosted.sort((a, b) => b.score - a.score);
}

/**
 * Applies confidence mapping from raw score to a 0-1 confidence.
 */
export function mapConfidence(score: number, method: MatchMethod): number {
  switch (method) {
    case "exact_code":
      return 1.0;
    case "exact_name":
    case "exact_normalized":
      return Math.min(0.98, score);
    case "levenshtein":
      if (score >= 0.95) return 0.9;
      if (score >= 0.90) return 0.8;
      if (score >= 0.85) return 0.7;
      return 0.5;
    case "trigram":
      if (score >= 0.8) return 0.85;
      if (score >= 0.6) return 0.7;
      if (score >= 0.4) return 0.5;
      return 0.3;
    case "semaphore_lookup":
      return 0.75;
    case "reverse_geocode":
      return 0.6;
    case "neighborhood_disambiguate":
      return 0.55;
    case "manual":
      return 1.0;
    default:
      return 0.0;
  }
}
