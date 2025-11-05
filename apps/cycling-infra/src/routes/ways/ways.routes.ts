import { createRoute, z } from "@hono/zod-openapi";

const WaySchema = z.object({
  id: z.number(),
  osm_id: z.string(),
  relation_id: z.number().nullable(),
  name: z.string().nullable(),
  geometry_type: z.string(),
  coordinates: z.any(),
  osm_properties: z.any(),
  geojson: z.any(),
  created_at: z.string(),
  updated_at: z.string(),
});

const WayListSchema = z.array(WaySchema);

const GeoJSONFeatureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(z.any()),
});

const SummarySchema = z.object({
  all: z.object({
    pdc_feito: z.number(),
    out_pdc: z.number(), 
    pdc_total: z.number(),
    percent: z.number(),
  }),
  byCity: z.record(z.object({
    pdc_feito: z.number(),
    out_pdc: z.number(),
    pdc_total: z.number(), 
    percent: z.number(),
  })),
});

export const listWaysRoute = createRoute({
  method: "get",
  path: "/v1/ways",
  summary: "List PDC ways",
  description: "Get all ways from PDC relations (planned routes)",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: WayListSchema,
        },
      },
      description: "List of PDC ways",
    },
  },
});

export const getWaysSummaryRoute = createRoute({
  method: "get",
  path: "/v1/ways/summary", 
  summary: "Get ways summary",
  description: "Get summary statistics of PDC implementation",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: SummarySchema,
        },
      },
      description: "Summary statistics",
    },
  },
});

export const getAllWaysGeoJSONRoute = createRoute({
  method: "get",
  path: "/v1/ways/all-ways",
  summary: "Get all ways as GeoJSON",
  description: "Get all ways combined as GeoJSON FeatureCollection",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            all: GeoJSONFeatureCollectionSchema,
            byCity: z.record(GeoJSONFeatureCollectionSchema),
          }),
        },
      },
      description: "GeoJSON FeatureCollection of all ways",
    },
  },
});