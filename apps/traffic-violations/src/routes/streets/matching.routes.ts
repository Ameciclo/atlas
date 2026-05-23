import { createRoute, z } from "@hono/zod-openapi";

const tags = ["Matching"];

// Reusable schemas
const matchCandidateSchema = z.object({
  street_code: z.number(),
  official_name: z.string(),
  short_name: z.string().nullable(),
  neighborhood_name: z.string().nullable(),
  score: z.number(),
  method: z.string(),
});

const normalizedDataSchema = z.object({
  raw: z.string(),
  cleaned: z.string().optional(),
  streetType: z.string().nullable().optional(),
  streetName: z.string().nullable().optional(),
  fullStreet: z.string().nullable().optional(),
  semaphoreNumber: z.string().nullable().optional(),
  addressNumber: z.string().nullable().optional(),
  direction: z.string().nullable().optional(),
  reference: z.string().nullable().optional(),
  postNumber: z.string().nullable().optional(),
});

// POST /v1/streets/match - Match a location description to streets
export const matchLocationRoute = createRoute({
  method: "post",
  path: "/streets/match",
  tags,
  summary: "Match a location description to streets",
  description: "Uses multiple strategies to match a raw location description to official streets.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            location_id: z.number().int().positive(),
            location_description: z.string().min(1),
            csv_street_code: z.number().int().optional(),
            latitude: z.number().optional(),
            longitude: z.number().optional(),
            neighborhood_hint: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            location_id: z.number(),
            matched: z.boolean(),
            confidence: z.number(),
            method: z.string().nullable(),
            needs_validation: z.boolean(),
            candidates: z.array(matchCandidateSchema),
            normalized: normalizedDataSchema.nullable(),
          }),
        },
      },
      description: "Match result for the location",
    },
    500: {
      content: {
        "application/json": {
          schema: z.object({ error: z.string() }),
        },
      },
      description: "Internal server error",
    },
  },
});

// POST /v1/streets/match/batch - Batch match multiple locations
export const batchMatchRoute = createRoute({
  method: "post",
  path: "/streets/match/batch",
  tags,
  summary: "Batch match locations to streets",
  description: "Match multiple location descriptions to official streets in one request.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            locations: z.array(z.object({
              location_id: z.number().int().positive(),
              location_description: z.string().min(1),
              csv_street_code: z.number().int().optional(),
              latitude: z.number().optional(),
              longitude: z.number().optional(),
              neighborhood_hint: z.string().optional(),
            })),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            results: z.array(z.object({
              location_id: z.number(),
              matched: z.boolean(),
              confidence: z.number(),
              method: z.string().nullable(),
              needs_validation: z.boolean(),
              candidates: z.array(matchCandidateSchema),
            })),
            stats: z.object({
              total: z.number(),
              matched: z.number(),
              unmatched: z.number(),
              auto_accepted: z.number(),
              needs_validation: z.number(),
              by_method: z.record(z.number()),
              avg_confidence: z.number(),
            }),
          }),
        },
      },
      description: "Batch match results",
    },
    500: {
      content: {
        "application/json": {
          schema: z.object({ error: z.string() }),
        },
      },
      description: "Internal server error",
    },
  },
});

// GET /v1/streets/match/stats - Get overall matching statistics
export const matchStatsRoute = createRoute({
  method: "get",
  path: "/streets/match/stats",
  tags,
  summary: "Get matching pipeline statistics",
  description: "Get statistics about the current state of the matching pipeline.",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            total_locations_matched: z.number(),
            total_locations_pending: z.number(),
            total_auto_accepted: z.number(),
            by_method: z.record(z.number()),
            validation_queue: z.object({
              pending: z.number(),
              confirmed: z.number(),
              rejected: z.number(),
            }),
          }),
        },
      },
      description: "Match statistics",
    },
    500: {
      content: {
        "application/json": {
          schema: z.object({ error: z.string() }),
        },
      },
      description: "Internal server error",
    },
  },
});

// GET /v1/streets/validations/pending - List pending validations
export const listValidationsRoute = createRoute({
  method: "get",
  path: "/streets/validations/pending",
  tags: ["Validation"],
  summary: "List locations pending human validation",
  description: "Get a paginated list of location matches that need human review.",
  request: {
    query: z.object({
      page: z.coerce.number().min(1).default(1).openapi({
        description: "Page number",
        example: 1,
      }),
      limit: z.coerce.number().min(1).max(100).default(20).openapi({
        description: "Number of items per page",
        example: 20,
      }),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(z.object({
              id: z.number(),
              location_id: z.number(),
              location_description: z.string(),
              extracted_street_name: z.string().nullable(),
              match_confidence: z.number().nullable(),
              match_method: z.string().nullable(),
              validation_status: z.string().nullable(),
              candidates: z.array(matchCandidateSchema).nullable(),
              normalized: normalizedDataSchema.nullable().optional(),
              created_at: z.string().nullable(),
            })),
            pagination: z.object({
              page: z.number(),
              limit: z.number(),
              total: z.number(),
              totalPages: z.number(),
            }),
          }),
        },
      },
      description: "Pending validations list",
    },
    500: {
      content: {
        "application/json": {
          schema: z.object({ error: z.string() }),
        },
      },
      description: "Internal server error",
    },
  },
});

// POST /v1/streets/validations/:id/confirm
export const confirmValidationRoute = createRoute({
  method: "post",
  path: "/streets/validations/{id}/confirm",
  tags: ["Validation"],
  summary: "Confirm a street match",
  description: "Human validates and confirms a street match suggestion.",
  request: {
    params: z.object({
      id: z.coerce.number().openapi({
        description: "Location street match ID",
        example: 1,
      }),
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            validated_by: z.string().min(1).optional().default("human"),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
      description: "Validation confirmed",
    },
    404: {
      content: {
        "application/json": {
          schema: z.object({ error: z.string() }),
        },
      },
      description: "Match not found",
    },
    500: {
      content: {
        "application/json": {
          schema: z.object({ error: z.string() }),
        },
      },
      description: "Internal server error",
    },
  },
});

// POST /v1/streets/validations/:id/reject
export const rejectValidationRoute = createRoute({
  method: "post",
  path: "/streets/validations/{id}/reject",
  tags: ["Validation"],
  summary: "Reject and override a street match",
  description: "Human rejects a match suggestion and optionally provides a correct street_code.",
  request: {
    params: z.object({
      id: z.coerce.number().openapi({
        description: "Location street match ID",
        example: 1,
      }),
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            validated_by: z.string().min(1).optional().default("human"),
            corrected_street_code: z.number().int().optional(),
            reason: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
      description: "Validation rejected",
    },
    404: {
      content: {
        "application/json": {
          schema: z.object({ error: z.string() }),
        },
      },
      description: "Match not found",
    },
    500: {
      content: {
        "application/json": {
          schema: z.object({ error: z.string() }),
        },
      },
      description: "Internal server error",
    },
  },
});

// LIST all match types for export
export const matchingRoutes = {
  matchLocationRoute,
  batchMatchRoute,
  matchStatsRoute,
  listValidationsRoute,
  confirmValidationRoute,
  rejectValidationRoute,
};
