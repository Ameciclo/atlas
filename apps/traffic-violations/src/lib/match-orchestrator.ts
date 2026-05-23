import { normalizeLocation, type NormalizedLocation } from "./street-normalizer.js";
import {
  matchExactName,
  matchHybridFuzzy,
  disambiguateByNeighborhood,
  mapConfidence,
  type StreetRecord,
  type MatchMethod,
  type MatchResult,
} from "./street-matcher.js";

export interface MatchInput {
  locationId: number;
  locationDescription: string;
  csvStreetCode?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  neighborhoodHint?: string | null;
}

export interface MatchOutput {
  locationId: number;
  locationDescription: string;
  normalized: NormalizedLocation;
  result: MatchResult;
  needsValidation: boolean;
}

export interface MatchOptions {
  autoAcceptThreshold: number;
  validationThreshold: number;
  streets: StreetRecord[];
  /** Map of codigo_logradouro -> street_code from the CSV */
  csvCodeLookup?: Map<number, number>;
  /** Map of semaphore_number -> street_code for known semaphores */
  semaphoreLookup?: Map<string, number>;
}

const DEFAULT_OPTIONS: MatchOptions = {
  autoAcceptThreshold: 0.85,
  validationThreshold: 0.50,
  streets: [],
};

/**
 * Orchestrates multiple matching strategies, falling through from
 * highest-confidence to lower-confidence methods.
 */
export function matchLocation(
  input: MatchInput,
  options: MatchOptions,
): MatchOutput {
  const normalized = normalizeLocation(input.locationDescription);
  const streets = options.streets;

  // --- Strategy 1: Exact CSV code match ---
  if (input.csvStreetCode && input.csvStreetCode > 0) {
    const street = streets.find((s) => s.code === input.csvStreetCode);
    if (street) {
      return buildOutput(input, normalized, {
        matched: true,
        candidates: [{ street, score: 1.0, method: "exact_code" }],
        method: "exact_code",
        confidence: 1.0,
      });
    }
  }

  // --- Strategy 2: Exact name match after normalization ---
  if (normalized.fullStreet) {
    const exactCandidates = matchExactName(normalized.fullStreet, streets);
    if (exactCandidates.length === 1 && exactCandidates[0]) {
      return buildOutput(input, normalized, {
        matched: true,
        candidates: exactCandidates,
        method: "exact_normalized",
        confidence: mapConfidence(exactCandidates[0].score, "exact_normalized"),
      });
    }
    if (exactCandidates.length > 1) {
      const disambiguated = disambiguateByNeighborhood(
        exactCandidates,
        input.neighborhoodHint || null,
      );
      const top = disambiguated[0];
      if (top) {
        return buildOutput(input, normalized, {
          matched: true,
          candidates: disambiguated,
          method: "exact_normalized",
          confidence: mapConfidence(top.score, "exact_normalized"),
        });
      }
    }
  }

  // --- Strategy 3: Fuzzy match on full street name ---
  if (normalized.fullStreet) {
    const fuzzyCandidates = matchHybridFuzzy(normalized.fullStreet, streets);
    if (fuzzyCandidates.length > 0) {
      const disambiguated = disambiguateByNeighborhood(
        fuzzyCandidates,
        input.neighborhoodHint || null,
      );
      const best = disambiguated[0];
      if (best && best.score >= 0.90) {
        return buildOutput(input, normalized, {
          matched: true,
          candidates: disambiguated.slice(0, 5),
          method: best.method,
          confidence: mapConfidence(best.score, best.method),
        });
      }
      if (best) {
        return buildOutput(input, normalized, {
          matched: best.score >= 0.80,
          candidates: disambiguated.slice(0, 5),
          method: best.method,
          confidence: mapConfidence(best.score, best.method),
        });
      }
    }
  }

  // --- Strategy 4: Fuzzy match on extracted street name only (no type) ---
  if (normalized.streetName && !normalized.fullStreet) {
    const fuzzyCandidates = matchHybridFuzzy(normalized.streetName, streets);
    if (fuzzyCandidates.length > 0) {
      const disambiguated = disambiguateByNeighborhood(
        fuzzyCandidates,
        input.neighborhoodHint || null,
      );
      const best = disambiguated[0];
      if (best) {
        return buildOutput(input, normalized, {
          matched: best.score >= 0.85,
          candidates: disambiguated.slice(0, 5),
          method: best.method,
          confidence: mapConfidence(best.score * 0.9, best.method),
        });
      }
    }
  }

  // --- Strategy 5: Try matching just the street name without type ---
  if (normalized.streetName && normalized.streetType) {
    const nameOnlyCandidates = matchHybridFuzzy(
      normalized.streetName,
      streets,
    );
    if (nameOnlyCandidates.length > 0) {
      const disambiguated = disambiguateByNeighborhood(
        nameOnlyCandidates,
        input.neighborhoodHint || null,
      );
      const best = disambiguated[0];
      if (best) {
        return buildOutput(input, normalized, {
          matched: best.score >= 0.85,
          candidates: disambiguated.slice(0, 5),
          method: best.method,
          confidence: mapConfidence(best.score * 0.85, best.method),
        });
      }
    }
  }

  // --- No match found ---
  return buildOutput(input, normalized, {
    matched: false,
    candidates: [],
    method: null,
    confidence: 0,
  });
}

function buildOutput(
  input: MatchInput,
  normalized: NormalizedLocation,
  result: MatchResult,
): MatchOutput {
  const needsValidation =
    result.confidence < DEFAULT_OPTIONS.autoAcceptThreshold &&
    result.confidence >= DEFAULT_OPTIONS.validationThreshold;

  return {
    locationId: input.locationId,
    locationDescription: input.locationDescription,
    normalized,
    result,
    needsValidation,
  };
}

/**
 * Batch-process locations through the matching pipeline.
 */
export function batchMatchLocations(
  inputs: MatchInput[],
  options: MatchOptions,
): MatchOutput[] {
  return inputs.map((input) => matchLocation(input, options));
}

/**
 * Build summary statistics from match results.
 */
export interface MatchStats {
  total: number;
  matched: number;
  unmatched: number;
  autoAccepted: number;
  needsValidation: number;
  byMethod: Record<string, number>;
  avgConfidence: number;
}

export function computeMatchStats(results: MatchOutput[]): MatchStats {
  const stats: MatchStats = {
    total: results.length,
    matched: 0,
    unmatched: 0,
    autoAccepted: 0,
    needsValidation: 0,
    byMethod: {},
    avgConfidence: 0,
  };

  let totalConfidence = 0;

  for (const r of results) {
    if (r.result.matched) {
      stats.matched++;
      totalConfidence += r.result.confidence;

      const method = r.result.method || "unknown";
      stats.byMethod[method] = (stats.byMethod[method] || 0) + 1;

      if (r.result.confidence >= DEFAULT_OPTIONS.autoAcceptThreshold) {
        stats.autoAccepted++;
      } else if (r.needsValidation) {
        stats.needsValidation++;
      }
    } else {
      stats.unmatched++;
    }
  }

  stats.avgConfidence =
    stats.matched > 0
      ? Math.round((totalConfidence / stats.matched) * 1000) / 1000
      : 0;

  return stats;
}
