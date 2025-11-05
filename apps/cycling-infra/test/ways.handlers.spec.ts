import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Context } from "hono";
import { listWays, getWaysSummary, getAllWaysGeoJSON } from "../src/routes/ways/ways.handlers.js";

// Mock the database
vi.mock("@atlas/database", () => ({
  createConnectedDatabase: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => Promise.resolve(mockWaysData))
    }))
  }))
}));

const mockWaysData = [
  {
    id: 1,
    osm_id: "relation/15997469",
    relation_id: null,
    name: "Test Way",
    geometry_type: "LineString",
    coordinates: "mock_coordinates",
    osm_properties: { highway: "primary" },
    geojson: {
      type: "Feature",
      geometry: { type: "LineString", coordinates: [] },
      properties: { name: "Test Way" }
    },
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z"
  }
];

const mockInfrastructureData = [
  {
    id: 1,
    osm_id: "way/42509040",
    name: "Test Infrastructure",
    infra_type: "Ciclofaixa"
  }
];

const createMockContext = () => ({
  json: vi.fn()
} as unknown as Context);

describe("Ways Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listWays", () => {
    it("should return ways list", async () => {
      const mockContext = createMockContext();
      
      await listWays(mockContext);
      
      expect(mockContext.json).toHaveBeenCalledWith(mockWaysData);
    });

    it("should handle database errors", async () => {
      const { createConnectedDatabase } = await import("@atlas/database");
      const mockDb = {
        select: vi.fn(() => ({
          from: vi.fn(() => Promise.reject(new Error("DB Error")))
        }))
      };
      vi.mocked(createConnectedDatabase).mockResolvedValueOnce(mockDb as any);
      
      const mockContext = createMockContext();
      
      await listWays(mockContext);
      
      expect(mockContext.json).toHaveBeenCalledWith(
        { error: "Internal server error" },
        500
      );
    });
  });

  describe("getWaysSummary", () => {
    it("should return summary statistics", async () => {
      const { createConnectedDatabase } = await import("@atlas/database");
      const mockDb = {
        select: vi.fn()
          .mockReturnValueOnce({
            from: vi.fn(() => Promise.resolve(mockWaysData))
          })
          .mockReturnValueOnce({
            from: vi.fn(() => Promise.resolve(mockInfrastructureData))
          })
      };
      vi.mocked(createConnectedDatabase).mockResolvedValueOnce(mockDb as any);
      
      const mockContext = createMockContext();
      
      await getWaysSummary(mockContext);
      
      expect(mockContext.json).toHaveBeenCalledWith({
        all: {
          pdc_feito: 0,
          out_pdc: 0,
          pdc_total: 0,
          percent: 0
        },
        byCity: {}
      });
    });
  });

  describe("getAllWaysGeoJSON", () => {
    it("should return GeoJSON FeatureCollection", async () => {
      const { createConnectedDatabase } = await import("@atlas/database");
      const mockDb = {
        select: vi.fn()
          .mockReturnValueOnce({
            from: vi.fn(() => Promise.resolve(mockWaysData))
          })
          .mockReturnValueOnce({
            from: vi.fn(() => Promise.resolve(mockInfrastructureData))
          })
      };
      vi.mocked(createConnectedDatabase).mockResolvedValueOnce(mockDb as any);
      
      const mockContext = createMockContext();
      
      await getAllWaysGeoJSON(mockContext);
      
      expect(mockContext.json).toHaveBeenCalledWith({
        all: {
          type: "FeatureCollection",
          features: expect.arrayContaining([
            expect.objectContaining({
              type: "Feature",
              properties: expect.objectContaining({
                STATUS: "NotPDC"
              })
            })
          ])
        },
        byCity: {}
      });
    });
  });
});