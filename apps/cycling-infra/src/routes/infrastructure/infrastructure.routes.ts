import { createRoute, z } from "@hono/zod-openapi";

const InfrastructureSchema = z.object({
  id: z.number(),
  osm_id: z.string(),
  name: z.string().nullable(),
  infra_type: z.string(),
  coordinates: z.any(), // PostGIS geometry
  geojson: z.any(),
  created_at: z.string(),
  updated_at: z.string(),
});

const InfrastructureListSchema = z.array(InfrastructureSchema);

export const listInfrastructureRoute = createRoute({
  method: "get",
  path: "/v1/infrastructure",
  summary: "List cycling infrastructure",
  description: "Get all cycling infrastructure from ciclomapa (existing infrastructure)",
  request: {
    query: z.object({
      type: z.string().optional().openapi({
        description: "Filter by infrastructure type",
        example: "Ciclofaixa"
      }),
      limit: z.string().optional().openapi({
        description: "Limit number of results",
        example: "100"
      }),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: InfrastructureListSchema,
        },
      },
      description: "List of cycling infrastructure",
    },
  },
});

export const getInfrastructureRoute = createRoute({
  method: "get", 
  path: "/v1/infrastructure/{id}",
  summary: "Get infrastructure by ID",
  description: "Get specific cycling infrastructure by ID",
  request: {
    params: z.object({
      id: z.string().openapi({
        description: "Infrastructure ID",
        example: "1"
      }),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: InfrastructureSchema,
        },
      },
      description: "Infrastructure details",
    },
    404: {
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: "Infrastructure not found",
    },
  },
});