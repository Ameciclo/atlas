import { describe, it, expect } from "vitest";
import { normalizeLocation, normalizeStreetName } from "../src/lib/street-normalizer.js";
import {
  levenshteinDistance,
  levenshteinSimilarity,
  trigramSimilarity,
  matchExactName,
  matchLevenshtein,
  matchTrigram,
  mapConfidence,
  type StreetRecord,
} from "../src/lib/street-matcher.js";
import { matchLocation, batchMatchLocations, computeMatchStats, type MatchInput } from "../src/lib/match-orchestrator.js";

const SAMPLE_STREETS: StreetRecord[] = [
  {
    code: 1025,
    nameConcatenated: "AVENIDA BOA VIAGEM",
    officialName: "Avenida Boa Viagem",
    shortName: "Av. Boa Viagem",
    neighborhoodCode: 205,
    neighborhoodName: "BOA VIAGEM",
  },
  {
    code: 10537,
    nameConcatenated: "RUA BARAO DE BEBERIBE",
    officialName: "Rua Barão de Beberibe",
    shortName: "R. Barão de Beberibe",
    neighborhoodCode: 205,
    neighborhoodName: "BOA VIAGEM",
  },
  {
    code: 21148,
    nameConcatenated: "RUA ELIZEU CESAR",
    officialName: "Rua Elizeu César",
    shortName: "R. Elizeu Cesar",
    neighborhoodCode: 850,
    neighborhoodName: "AREIAS",
  },
  {
    code: 28169,
    nameConcatenated: "RUA DR CARLOS ALVES",
    officialName: "Rua Dr Carlos Alves",
    shortName: "R. Dr Carlos Alves",
    neighborhoodCode: 671,
    neighborhoodName: "ZUMBI",
  },
  {
    code: 22047,
    nameConcatenated: "RUA ENGENHO MATARI",
    officialName: "Rua Engenho Matari",
    shortName: "R. Engenho Matari",
    neighborhoodCode: 884,
    neighborhoodName: "COHAB",
  },
  {
    code: 6939,
    nameConcatenated: "RUA ARACATUBA",
    officialName: "Rua Araçatuba",
    shortName: "R. Aracatuba",
    neighborhoodCode: 213,
    neighborhoodName: "IPSEP",
  },
  {
    code: 87416,
    nameConcatenated: "RUA DOS PALMARES",
    officialName: "Rua dos Palmares",
    shortName: "R. dos Palmares",
    neighborhoodCode: 700,
    neighborhoodName: "SANTO AMARO",
  },
  {
    code: 55867,
    nameConcatenated: "RUA SITIO DOS COQUEIROS",
    officialName: "Rua Sítio dos Coqueiros",
    shortName: "R. Sítio Dos Coqueiros",
    neighborhoodCode: 736,
    neighborhoodName: "VARZEA",
  },
];

describe("Street Normalizer", () => {
  describe("normalizeStreetName", () => {
    it("should remove accents and uppercase", () => {
      expect(normalizeStreetName("Rua Araçatuba")).toBe("RUA ARACATUBA");
      expect(normalizeStreetName("Rua Sítio dos Coqueiros")).toBe("RUA SITIO DOS COQUEIROS");
    });

    it("should expand common abbreviations", () => {
      expect(normalizeStreetName("R. DR. JOSE MARIA")).toBe("RUA DOUTOR JOSE MARIA");
      expect(normalizeStreetName("AV. PROF. JOSE")).toBe("AVENIDA PROFESSOR JOSE");
    });
  });

  describe("normalizeLocation", () => {
    it("should extract clean street name from simple location", () => {
      const result = normalizeLocation("AVENIDA BOA VIAGEM, EM FRENTE AO SEMAFORO N. 2784");
      expect(result.fullStreet).toBe("AVENIDA BOA VIAGEM");
      expect(result.streetType).toBe("AVENIDA");
      expect(result.streetName).toBe("BOA VIAGEM");
      expect(result.semaphoreNumber).toBe("2784");
    });

    it("should clean double prefix RUA RUA", () => {
      const result = normalizeLocation("RUA RUA DOIS DE FEVEREIRO, AO LADO AO N. 529");
      expect(result.fullStreet).toBe("RUA DOIS DE FEVEREIRO");
      expect(result.streetType).toBe("RUA");
    });

    it("should clean RUA AVENIDA corruption", () => {
      const result = normalizeLocation("RUA AVENIDA ANTONIO DE GOES, EM FRENTE AO N. 200");
      expect(result.streetType).toBe("AVENIDA");
      expect(result.streetName).toBe("ANTONIO DE GOES");
    });

    it("should handle abbreviated street types", () => {
      const result = normalizeLocation("R. DR. JOSE MARIA, LADO OPOSTO AO POSTE");
      expect(result.streetType).toBe("RUA");
      expect(result.streetName).toBe("DOUTOR JOSE MARIA");
    });

    it("should handle AV abbreviation", () => {
      const result = normalizeLocation("AV DR JOSE RUFINO, SOB AO SEMAFORO N 044");
      expect(result.streetType).toBe("AVENIDA");
      expect(result.streetName).toBe("DOUTOR JOSE RUFINO");
      expect(result.semaphoreNumber).toBe("044");
    });

    it("should handle PRACA prefix", () => {
      const result = normalizeLocation("PRACA JOAQUIM NABUCO, SOB AO N. 71");
      expect(result.streetType).toBe("PRACA");
      expect(result.streetName).toBe("JOAQUIM NABUCO");
    });

    it("should extract direction", () => {
      const result = normalizeLocation("RUA DOS PALMARES SEMAFORO NR 030 SENTIDO SUBURBIO");
      expect(result.semaphoreNumber).toBe("030");
      expect(result.direction).toBe("SENTIDO SUBURBIO");
    });

    it("should handle locations without recognized type", () => {
      const result = normalizeLocation("CORREGO DO BARTOLOMEU, EM FRENTE AO N. 509");
      expect(result.streetType).toBe("CORREGO");
      expect(result.streetName).toBe("DO BARTOLOMEU");
    });

    it("should extract post number", () => {
      const result = normalizeLocation("RUA IMPERADOR PEDRO SEGUNDO, EM FRENTE AO POSTE N. B017383");
      expect(result.streetName).toContain("IMPERADOR");
      expect(result.postNumber).toBe("B017383");
    });
  });
});

describe("Street Matcher", () => {
  describe("levenshteinDistance", () => {
    it("should return 0 for identical strings", () => {
      expect(levenshteinDistance("RUA BOA VIAGEM", "RUA BOA VIAGEM")).toBe(0);
    });

    it("should return correct distance for substitutions", () => {
      expect(levenshteinDistance("RUA BOA VIAGE", "RUA BOA VIAGEM")).toBe(1);
      expect(levenshteinDistance("AVENIDA BOA VIAGEM", "RUA BOA VIAGEM")).toBe(6);
    });

    it("should handle empty strings", () => {
      expect(levenshteinDistance("", "ABC")).toBe(3);
      expect(levenshteinDistance("ABC", "")).toBe(3);
      expect(levenshteinDistance("", "")).toBe(0);
    });
  });

  describe("levenshteinSimilarity", () => {
    it("should return 1 for identical strings", () => {
      expect(levenshteinSimilarity("RUA BOA VIAGEM", "RUA BOA VIAGEM")).toBe(1);
    });

    it("should return ~0.93 for one missing character", () => {
      const sim = levenshteinSimilarity("RUA BOA VIAGE", "RUA BOA VIAGEM");
      expect(sim).toBeGreaterThan(0.9);
      expect(sim).toBeLessThan(1);
    });

    it("should have lower score for very different strings", () => {
      const sim = levenshteinSimilarity("RUA BOA VIAGEM", "AVENIDA ENGENHO MATARI");
      expect(sim).toBeLessThan(0.5);
    });
  });

  describe("trigramSimilarity", () => {
    it("should return 1 for identical strings", () => {
      expect(trigramSimilarity("BOA VIAGEM", "BOA VIAGEM")).toBe(1);
    });

    it("should have good similarity for similar names", () => {
      const sim = trigramSimilarity("BOA VIAGEM", "BOA VIAGE");
      expect(sim).toBeGreaterThan(0.5);
    });
  });

  describe("matchExactName", () => {
    it("should match exact normalized street names", () => {
      const results = matchExactName("Rua dos Palmares", SAMPLE_STREETS);
      expect(results).toHaveLength(1);
      expect(results[0].street.code).toBe(87416);
      expect(results[0].method).toBe("exact_normalized");
    });

    it("should handle accent differences", () => {
      const results = matchExactName("Rua Araçatuba", SAMPLE_STREETS);
      expect(results).toHaveLength(1);
      expect(results[0].street.code).toBe(6939);
    });
  });

  describe("matchLevenshtein", () => {
    it("should match with high similarity", () => {
      const results = matchLevenshtein("AVENIDA BOA VIAGEM", SAMPLE_STREETS, 0.80);
      expect(results).toHaveLength(1);
      expect(results[0].street.code).toBe(1025);
    });

    it("should return multiple candidates for ambiguous names", () => {
      const results = matchLevenshtein("RUA ENGENHO", SAMPLE_STREETS, 0.5);
      // "RUA ENGENHO" should fuzzy match "RUA ENGENHO MATARI"
      expect(results.length).toBeGreaterThan(0);
    });
  });
});

describe("Match Orchestrator", () => {
  it("should use exact code match (Strategy 1) when csvStreetCode is valid", () => {
    const result = matchLocation(
      {
        locationId: 12,
        locationDescription: "AVENIDA BOA VIAGEM, EM FRENTE AO SEMAFORO N. 2784",
        csvStreetCode: 1025,
      },
      { streets: SAMPLE_STREETS, autoAcceptThreshold: 0.85, validationThreshold: 0.50 },
    );
    expect(result.result.matched).toBe(true);
    expect(result.result.method).toBe("exact_code");
    expect(result.result.confidence).toBe(1.0);
    expect(result.needsValidation).toBe(false);
  });

  it("should use exact normalized name match (Strategy 2) when no code", () => {
    const result = matchLocation(
      {
        locationId: 13,
        locationDescription: "AVENIDA BOA VIAGEM, EM FRENTE AO SEMAFORO N. 2784",
      },
      { streets: SAMPLE_STREETS, autoAcceptThreshold: 0.85, validationThreshold: 0.50 },
    );
    expect(result.result.matched).toBe(true);
    expect(result.result.method).toBe("exact_normalized");
  });

  it("should use fuzzy match for slightly different names", () => {
    const result = matchLocation(
      {
        locationId: 14,
        locationDescription: "AVENIDA BOA VIAGE, SOB O SEMAFORO N. 2784",
      },
      { streets: SAMPLE_STREETS, autoAcceptThreshold: 0.85, validationThreshold: 0.50 },
    );
    expect(result.result.matched).toBe(true);
    // Fuzzy match via levenshtein or trigram
    expect(["levenshtein", "trigram"]).toContain(result.result.method);
  });

  it("should flag low-confidence matches for validation", () => {
    const result = matchLocation(
      {
        locationId: 15,
        locationDescription: "RUA BOA, AO LADO DO MERCADO",
      },
      { streets: SAMPLE_STREETS, autoAcceptThreshold: 0.85, validationThreshold: 0.50 },
    );
    // Should match something with low confidence or not match
    if (result.result.matched) {
      // If matched, should need validation due to low confidence
      expect(result.result.confidence).toBeLessThan(0.85);
    }
    // Either way, the result should be sound
    expect(result.normalized).toBeDefined();
  });

  it("should batch match multiple locations", () => {
    const inputs: MatchInput[] = [
      {
        locationId: 1,
        locationDescription: "AVENIDA BOA VIAGEM, EM FRENTE AO SEMAFORO N. 2784",
        csvStreetCode: 1025,
      },
      {
        locationId: 2,
        locationDescription: "RUA SITIO DOS COQUEIROS, EM FRENTE AO N. 100",
      },
      {
        locationId: 3,
        locationDescription: "XYZ COMPLETELY UNKNOWN STREET NAME",
      },
    ];
    const results = batchMatchLocations(inputs, {
      streets: SAMPLE_STREETS,
      autoAcceptThreshold: 0.85,
      validationThreshold: 0.50,
    });

    expect(results).toHaveLength(3);
    // First: CSV match should succeed
    expect(results[0].result.matched).toBe(true);
    // Second: should match via exact name
    expect(results[1].result.matched).toBe(true);
    // Third: should not match
    expect(results[2].result.matched).toBe(false);
  });

  describe("computeMatchStats", () => {
    it("should compute accurate statistics", () => {
      const inputs: MatchInput[] = [
        {
          locationId: 1,
          locationDescription: "AVENIDA BOA VIAGEM",
          csvStreetCode: 1025,
        },
        {
          locationId: 2,
          locationDescription: "RUA DOUTOR CARLOS ALVES",
        },
        {
          locationId: 3,
          locationDescription: "UNKNOWN STREET XYZ ABC",
        },
      ];
      const results = batchMatchLocations(inputs, {
        streets: SAMPLE_STREETS,
        autoAcceptThreshold: 0.85,
        validationThreshold: 0.50,
      });
      const stats = computeMatchStats(results);

      expect(stats.total).toBe(3);
      expect(stats.matched).toBeGreaterThanOrEqual(2);
      expect(stats.unmatched).toBeLessThanOrEqual(1);
      expect(stats.byMethod["exact_code"]).toBe(1);
    });
  });
});

describe("mapConfidence", () => {
  it("should return 1.0 for exact_code", () => {
    expect(mapConfidence(1.0, "exact_code")).toBe(1.0);
  });

  it("should cap exact_normalized at 0.98", () => {
    expect(mapConfidence(1.0, "exact_normalized")).toBe(0.98);
  });

  it("should scale levenshtein confidence", () => {
    expect(mapConfidence(0.95, "levenshtein")).toBe(0.9);
    expect(mapConfidence(0.90, "levenshtein")).toBe(0.8);
    expect(mapConfidence(0.85, "levenshtein")).toBe(0.7);
    expect(mapConfidence(0.70, "levenshtein")).toBe(0.5);
  });

  it("should scale trigram confidence", () => {
    expect(mapConfidence(0.80, "trigram")).toBe(0.85);
    expect(mapConfidence(0.60, "trigram")).toBe(0.7);
    expect(mapConfidence(0.30, "trigram")).toBe(0.3);
  });
});
