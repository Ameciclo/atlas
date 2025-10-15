# Creating a New Service in Atlas

This guide walks you through creating a new service in the Atlas monorepo using the `create-atlas-app` scaffolding tool.

## Quick Start

```bash
# From the root of the monorepo
pnpm create-atlas-app
```

That's it! The tool will guide you through the process.

## Step-by-Step Guide

### 1. Run the Scaffolding Tool

```bash
pnpm create-atlas-app
```

Or with a service name:

```bash
pnpm create-atlas-app rides-service
```

### 2. Answer the Prompts

The tool will ask you:

```
🚀 Create Atlas App

? What is the name of your app? › rides-service
? App description: › API service for managing bicycle rides
? Default port: › 3001
? Include PostgreSQL database setup? › Yes
? Database name: › rides_db
```

**Tips:**
- Use kebab-case for the app name (e.g., `rides-service`, `user-auth`)
- Choose a unique port (check existing services in `apps/`)
- Include database if you need to store data

### 3. Install Dependencies

```bash
pnpm install
```

This installs dependencies for the entire monorepo, including your new service.

### 4. Start Development

```bash
# Start your service
pnpm --filter @atlas/rides-service dev

# Or start all services
pnpm dev
```

Your service will be available at `http://localhost:3001` (or your chosen port).

### 5. Set Up Database (If Included)

```bash
# Generate initial migration
pnpm --filter @atlas/rides-service db:generate

# Run migrations
pnpm --filter @atlas/rides-service db:migrate

# (Optional) Seed the database
pnpm --filter @atlas/rides-service db:seed
```

### 6. Test Your Service

```bash
# Run tests
pnpm --filter @atlas/rides-service test

# Or in watch mode
pnpm --filter @atlas/rides-service test:watch
```

## What Gets Created

### Directory Structure

```
apps/rides-service/
├── src/
│   ├── app.ts                 # App configuration
│   ├── index.ts               # Entry point
│   ├── env.ts                 # Environment validation
│   ├── generate-openapi.ts    # OpenAPI spec generator
│   ├── db/                    # Database (if included)
│   │   ├── index.ts           # DB connection
│   │   ├── schema.ts          # Drizzle schema
│   │   ├── migrate.ts         # Migration runner
│   │   ├── seed.ts            # Seeder
│   │   └── migrations/        # Migration files
│   ├── lib/
│   │   ├── create-app.ts      # App factory
│   │   ├── types.ts           # TypeScript types
│   │   └── constants.ts       # Constants
│   ├── middlewares/
│   │   └── pino-logger.ts     # Logger
│   └── routes/
│       ├── health.ts          # Health check
│       └── example/           # Example routes
│           ├── example.routes.ts
│           ├── example.handlers.ts
│           └── example.index.ts
├── test/
│   └── rides-service.spec.ts  # Example test
├── Dockerfile                 # Docker build
├── docker-compose.yml         # Local dev setup
├── drizzle.config.ts          # Drizzle config (if DB)
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript config
├── vitest.config.ts           # Test config
├── .env.example               # Env template
└── README.md                  # Documentation
```

### Available Scripts

```bash
# Development
pnpm --filter @atlas/rides-service dev          # Start dev server
pnpm --filter @atlas/rides-service build        # Build for production
pnpm --filter @atlas/rides-service start        # Start production server

# Database (if included)
pnpm --filter @atlas/rides-service db:generate  # Generate migrations
pnpm --filter @atlas/rides-service db:migrate   # Run migrations
pnpm --filter @atlas/rides-service db:studio    # Open Drizzle Studio
pnpm --filter @atlas/rides-service db:seed      # Seed database

# Testing & Quality
pnpm --filter @atlas/rides-service test         # Run tests
pnpm --filter @atlas/rides-service test:watch   # Watch mode
pnpm --filter @atlas/rides-service check-types  # Type check
pnpm --filter @atlas/rides-service lint         # Lint code
pnpm --filter @atlas/rides-service format       # Format code

# OpenAPI
pnpm --filter @atlas/rides-service generate-openapi  # Generate spec
```

## Next Steps

### 1. Customize Your Service

#### Add New Routes

Create a new route directory:

```bash
mkdir -p apps/rides-service/src/routes/rides
```

Create route files:

```typescript
// apps/rides-service/src/routes/rides/rides.routes.ts
import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const rideSchema = z.object({
  id: z.number(),
  cyclist_id: z.number(),
  distance_km: z.number(),
  duration_minutes: z.number(),
});

export const list = createRoute({
  path: "/rides",
  method: "get",
  tags: ["Rides"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(rideSchema),
      "List of rides"
    ),
  },
});
```

```typescript
// apps/rides-service/src/routes/rides/rides.handlers.ts
import type { AppRouteHandler } from "../../lib/types.js";
import type * as routes from "./rides.routes.js";

export const list: AppRouteHandler<routes.ListRoute> = async (c) => {
  // Your logic here
  return c.json([]);
};
```

```typescript
// apps/rides-service/src/routes/rides/rides.index.ts
import { createRouter } from "../../lib/create-app.js";
import * as handlers from "./rides.handlers.js";
import * as routes from "./rides.routes.js";

const router = createRouter()
  .openapi(routes.list, handlers.list);

export default router;
```

Update `app.ts`:

```typescript
import createApp from "./lib/create-app.js";
import healthRoutes from "./routes/health.js";
import ridesRoutes from "./routes/rides/rides.index.js";

const app = createApp()
  .route("/", healthRoutes)
  .route("/v1/", ridesRoutes);

export default app;
```

#### Update Database Schema

```typescript
// apps/rides-service/src/db/schema.ts
import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const rides = pgTable("rides", {
  id: serial("id").primaryKey(),
  cyclist_id: integer("cyclist_id").notNull(),
  distance_km: integer("distance_km").notNull(),
  duration_minutes: integer("duration_minutes").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const insertRideSchema = createInsertSchema(rides);
export const selectRideSchema = createSelectSchema(rides);

export type Ride = typeof rides.$inferSelect;
export type InsertRide = typeof rides.$inferInsert;
```

Generate and run migration:

```bash
pnpm --filter @atlas/rides-service db:generate
pnpm --filter @atlas/rides-service db:migrate
```

### 2. Add Environment Variables

Update `src/env.ts`:

```typescript
const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  PORT: z.coerce.number().default(3001),

  // Add your variables
  API_KEY: z.string().min(1),
  EXTERNAL_SERVICE_URL: z.string().url().optional(),
});
```

Update `.env.example`:

```bash
# Add to .env.example
API_KEY=your-api-key-here
EXTERNAL_SERVICE_URL=http://localhost:3000
```

### 3. Write Tests

```typescript
// test/rides.spec.ts
import { describe, it, expect } from "vitest";
import app from "../src/app.js";

describe("Rides API", () => {
  it("should list rides", async () => {
    const res = await app.request("/v1/rides");
    expect(res.status).toBe(200);
    
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});
```

### 4. Deploy

The service is automatically integrated with CI/CD:

1. **Push to GitHub** - CI runs tests and builds
2. **Merge to main** - Docker image is built and pushed
3. **Deploy** - Use Portainer or your deployment tool

No additional configuration needed!

## Common Patterns

### Pattern 1: CRUD Operations

```typescript
// routes/rides/rides.routes.ts
export const create = createRoute({
  path: "/rides",
  method: "post",
  request: {
    body: jsonContentRequired(insertRideSchema, "Ride to create"),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(selectRideSchema, "Created ride"),
  },
});

export const getOne = createRoute({
  path: "/rides/{id}",
  method: "get",
  request: { params: IdParamsSchema },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectRideSchema, "Ride details"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "Not found"),
  },
});
```

### Pattern 2: Validation

```typescript
// Use Zod for validation
const createRideSchema = z.object({
  cyclist_id: z.number().positive(),
  distance_km: z.number().positive().max(1000),
  duration_minutes: z.number().positive().max(1440),
});
```

### Pattern 3: Error Handling

```typescript
export const create: AppRouteHandler<routes.CreateRoute> = async (c) => {
  try {
    const body = c.req.valid("json");
    const ride = await db.insert(rides).values(body).returning();
    return c.json(ride[0], HttpStatusCodes.CREATED);
  } catch (error) {
    c.get("logger").error(error, "Failed to create ride");
    return c.json({ error: "Failed to create ride" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};
```

## Troubleshooting

### Port Already in Use

Change the port in `.env`:

```bash
PORT=3002
```

### Database Connection Failed

Check your database is running:

```bash
docker compose up postgres -d
```

Verify connection string in `.env`:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/rides_db
```

### TypeScript Errors

Rebuild the project:

```bash
pnpm --filter @atlas/rides-service build
```

### Tests Failing

Make sure database is set up:

```bash
NODE_ENV=test pnpm --filter @atlas/rides-service db:migrate
```

## Best Practices

1. ✅ **Use Zod schemas** for all validation
2. ✅ **Write tests** for all routes
3. ✅ **Log errors** with context
4. ✅ **Validate environment** variables
5. ✅ **Document APIs** with OpenAPI
6. ✅ **Use TypeScript** strict mode
7. ✅ **Handle errors** gracefully
8. ✅ **Add health checks** for dependencies
9. ✅ **Use migrations** for schema changes
10. ✅ **Follow naming conventions** (kebab-case for files)

## Resources

- [Scaffolding Tool Documentation](./SCAFFOLDING_TOOL.md)
- [Documentation Summary](./SUMMARY.md)
- [Main README](../README.md)

