import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { selectBicycleRackSchema } from "@atlas/database/schemas/bicycle-racks";

const tags = ["Bicycle Racks"];

const statsSchema = z.object({
  total: z.number(),
  covered: z.number(),
  public_access: z.number(),
  avg_capacity: z.number(),
  by_operator: z.record(z.number()),
});

const geoJsonSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(z.object({
    type: z.literal("Feature"),
    properties: z.record(z.any()),
    geometry: z.object({
      type: z.literal("Point"),
      coordinates: z.array(z.number()),
    }),
  })),
});

export const list = createRoute({
  path: "/bicycle-racks",
  method: "get",
  tags,
  request: {
    query: z.object({
      covered: z.enum(["yes", "no"]).optional(),
      access: z.enum(["yes", "private", "permissive", "customers"]).optional(),
      capacity_min: z.string().regex(/^\d+$/).transform(Number).optional(),
      capacity_max: z.string().regex(/^\d+$/).transform(Number).optional(),
      operator: z.string().optional(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(selectBicycleRackSchema),
      "List of bicycle racks",
    ),
  },
});

export const getById = createRoute({
  path: "/bicycle-racks/{id}",
  method: "get",
  tags,
  request: {
    params: z.object({
      id: z.string().regex(/^\d+$/, "ID must be a valid number").transform(Number),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectBicycleRackSchema,
      "Bicycle rack details",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ message: z.string() }),
      "Bicycle rack not found",
    ),
  },
});

export const nearby = createRoute({
  path: "/bicycle-racks/nearby",
  method: "get",
  tags,
  request: {
    query: z.object({
      lat: z.string().regex(/^-?\d+(\.\d+)?$/, "Latitude must be a valid number").transform(Number),
      lng: z.string().regex(/^-?\d+(\.\d+)?$/, "Longitude must be a valid number").transform(Number),
      radius: z.string().regex(/^\d+(\.\d+)?$/, "Radius must be a valid positive number").transform(Number).default("1000"),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(selectBicycleRackSchema.extend({
        distance: z.number(),
      })),
      "Nearby bicycle racks",
    ),
  },
});

export const stats = createRoute({
  path: "/bicycle-racks/stats",
  method: "get",
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      statsSchema,
      "Bicycle racks statistics",
    ),
  },
});

export const geojson = createRoute({
  path: "/bicycle-racks/geojson",
  method: "get",
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      geoJsonSchema,
      "Bicycle racks as GeoJSON",
    ),
  },
});

export type ListRoute = typeof list;
export type GetByIdRoute = typeof getById;
export type NearbyRoute = typeof nearby;
export type StatsRoute = typeof stats;
export type GeoJsonRoute = typeof geojson;