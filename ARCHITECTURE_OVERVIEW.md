# Atlas Architecture Overview

A comprehensive guide to how the Atlas monorepo works.

## Table of Contents

1. [High-Level Architecture](#high-level-architecture)
2. [Database Architecture](#database-architecture)
3. [Request Flow](#request-flow)
4. [Development Workflow](#development-workflow)
5. [CI/CD Pipeline](#cicd-pipeline)
6. [Key Components](#key-components)

---

## High-Level Architecture

### Monorepo Structure

```
atlas/
├── apps/                    # Applications (services)
│   ├── cyclist-profile/     # Cyclist profile API service
│   └── docs/                # API documentation site
├── packages/                # Shared packages
│   ├── database/            # Shared database (Drizzle ORM)
│   ├── typescript-config/   # Shared TypeScript config
│   └── create-atlas-app/    # Service generator
└── docker-compose.yml       # Development database
```

### Technology Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **Language**: TypeScript (ES Modules)
- **API Framework**: Hono + Zod OpenAPI
- **Database**: PostgreSQL 16 + PostGIS
- **ORM**: Drizzle ORM
- **Code Quality**: Biome (formatting + linting)
- **CI/CD**: GitHub Actions
- **Containerization**: Docker

---

## Database Architecture

### Single Database, Multiple Schemas

Instead of separate databases per service, Atlas uses **PostgreSQL schemas** for isolation:

```
PostgreSQL Instance
└── atlas (database)
    ├── cyclist_profile (schema)
    │   └── cyclist_profiles (table)
    ├── analytics (schema)
    │   └── events (table)
    └── notifications (schema)
        └── notifications (table)
```

### Why This Approach?

**Benefits:**
- ✅ Single database to manage
- ✅ Cross-service queries possible
- ✅ Simpler backup/restore
- ✅ Easier local development
- ✅ Simplified queries (no schema prefixes)

**Trade-offs:**
- ⚠️ Services share database instance
- ⚠️ Requires coordination for migrations
- ⚠️ Table naming conventions important for clarity

### Database Package Structure

```
packages/database/
├── src/
│   ├── connection.ts           # Database connection utilities
│   ├── migrate.ts              # Migration runner
│   ├── index.ts                # Public API
│   ├── schemas/                # Service table definitions
│   │   └── cyclist-profile/
│   │       ├── index.ts
│   │       └── schema.ts       # Table definitions
│   └── migrations/             # Generated migrations
│       ├── 0000_initial.sql
│       └── meta/
├── drizzle.config.ts           # Drizzle Kit config
└── package.json
```

---

## Request Flow

### 1. Application Startup

```typescript
// apps/cyclist-profile/src/db/index.ts
import { drizzle } from 'drizzle-orm/node-postgres'
import { Client } from 'pg'
import * as schema from '@atlas/database/schemas/cyclist-profile'

// Connect to database (top-level await)
const client = new Client({
  connectionString: process.env.DATABASE_URL
})
await client.connect()

// Create Drizzle instance with schema
export const db = drizzle(client, { schema })
```

**What happens:**
1. Module is imported
2. PostgreSQL client connects to `atlas` database
3. Drizzle wraps the client with type-safe query API
4. Schema provides TypeScript types for tables

### 2. Route Registration

```typescript
// apps/cyclist-profile/src/app.ts
import createApp from './lib/create-app.js'
import cyclistProfilesRoutes from './routes/cyclist-profiles/cyclist-profiles.index.js'

const app = createApp()
  .route('/v1/', cyclistProfilesRoutes)

export default app
```

**What happens:**
1. Hono app is created
2. Routes are registered with OpenAPI schemas
3. Handlers are attached to routes

### 3. HTTP Request Processing

```
Client Request
    ↓
Hono Router (matches /v1/cyclist-profiles)
    ↓
Route Handler (cyclist-profiles.handlers.ts)
    ↓
Database Query (db.query.cyclistProfiles.findMany())
    ↓
Drizzle ORM (builds SQL)
    ↓
PostgreSQL (executes: SELECT * FROM cyclist_profile.cyclist_profiles)
    ↓
Drizzle ORM (maps rows to TypeScript types)
    ↓
Route Handler (formats response)
    ↓
Hono (sends JSON response)
    ↓
Client Response
```

### 4. Example Handler

```typescript
// apps/cyclist-profile/src/routes/cyclist-profiles/cyclist-profiles.handlers.ts
import { db } from '../../db/index.js'

export const list: RouteHandler<ListRoute> = async (c) => {
  // Type-safe query with autocomplete
  const cyclistProfiles = await db.query.cyclistProfiles.findMany()
  
  // Return JSON response
  return c.json(cyclistProfiles)
}
```

**What happens:**
1. Handler receives Hono context (`c`)
2. Queries database using Drizzle's query API
3. TypeScript knows the shape of `cyclistProfiles`
4. Returns JSON response with proper types

---

## Development Workflow

### Local Development Setup

```bash
# 1. Start database
docker-compose up -d

# 2. Run migrations
pnpm --filter @atlas/database db:migrate

# 3. Start development server
pnpm --filter @atlas/cyclist-profile dev
```

### Making Schema Changes

```bash
# 1. Edit schema file
# packages/database/src/schemas/cyclist-profile/schema.ts

# 2. Generate migration
pnpm --filter @atlas/database db:generate

# 3. Review migration
# packages/database/src/migrations/0001_*.sql

# 4. Run migration
pnpm --filter @atlas/database db:migrate

# 5. Verify in Drizzle Studio
pnpm --filter @atlas/database db:studio
```

### Adding a New Service

```bash
# 1. Create schema in database package
packages/database/src/schemas/my-service/schema.ts

# 2. Create app
apps/my-service/

# 3. Create database connection
apps/my-service/src/db/index.ts

# 4. Import schema
import * as schema from '@atlas/database/schemas/my-service'

# 5. Generate migration
pnpm --filter @atlas/database db:generate

# 6. Run migration
pnpm --filter @atlas/database db:migrate
```

---

## CI/CD Pipeline

### Build Job (No Database)

```yaml
- name: Build
  run: pnpm build
```

**What happens:**
1. TypeScript compiles to JavaScript
2. No database connection needed
3. Fast builds (~30 seconds)

**Why it works:**
- Database connection uses top-level await
- Connection only happens when module is imported at runtime
- Build process doesn't import runtime modules

### OpenAPI Generation Job (With Database)

```yaml
services:
  postgres:
    image: postgis/postgis:16-3.5
    env:
      POSTGRES_DB: atlas

steps:
  - name: Run migrations
    run: pnpm --filter @atlas/database db:migrate
    
  - name: Generate OpenAPI
    run: pnpm --filter @atlas/cyclist-profile generate-openapi
    
  - name: Commit specs
    run: |
      git add apps/docs/public/openapi/*.json
      git commit -m "chore: update OpenAPI specs [skip ci]"
      git push
```

**What happens:**
1. PostgreSQL service starts in CI
2. Migrations create schemas and tables
3. OpenAPI generation imports app (connects to database)
4. Hono generates OpenAPI spec from routes
5. Spec is committed back to repository

**Why this approach:**
- ✅ Specs always match actual database schema
- ✅ Specs are version-controlled
- ✅ Builds remain fast (no database)
- ✅ Specs available for docs app

### Docker Build Job

```yaml
- name: Detect changed apps
  run: pnpm build --filter=...[origin/main...HEAD] --dry=json
  
- name: Build Docker images
  run: docker build -f apps/cyclist-profile/Dockerfile .
  
- name: Push to GHCR
  run: docker push ghcr.io/ameciclo/atlas/cyclist-profile:latest
```

**What happens:**
1. Turborepo detects which apps changed
2. Only changed apps get Docker images built
3. Images pushed to GitHub Container Registry
4. Ready for deployment via Portainer

---

## Key Components

### 1. Database Connection (`packages/database/src/connection.ts`)

```typescript
export interface DatabaseConfig {
  connectionString?: string
}

export interface AtlasDatabase extends NodePgDatabase<Record<string, unknown>> {
  client: Client
}

export async function createConnectedDatabase(config: DatabaseConfig = {}): Promise<AtlasDatabase> {
  const connectionString = config.connectionString || process.env.DATABASE_URL
  
  const client = new Client({ connectionString })
  await client.connect()
  
  const db = drizzle(client, { schema: {} }) as AtlasDatabase
  db.client = client
  
  return db
}
```

**Purpose:** Centralized database connection logic

### 2. Migration Runner (`packages/database/src/migrate.ts`)

```typescript
export async function runMigrations(config: MigrationConfig = {}): Promise<void> {
  const db = await createConnectedDatabase(config)

  // Run migrations
  await migrate(db, {
    migrationsFolder: config.migrationsFolder || './src/migrations'
  })

  await closeDatabase(db)
}
```

**Purpose:** Run database migrations

### 3. Service Schema (`packages/database/src/schemas/cyclist-profile/schema.ts`)

```typescript
import { pgTable, serial, jsonb, timestamp } from 'drizzle-orm/pg-core'

export const cyclistProfiles = pgTable('cyclist_profiles', {
  id: serial('id').primaryKey(),
  data: jsonb('data').notNull(),
  metadata: jsonb('metadata').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
})

export type CyclistProfile = typeof cyclistProfiles.$inferSelect
export type NewCyclistProfile = typeof cyclistProfiles.$inferInsert
```

**Purpose:** Define tables in the public schema with TypeScript types

### 5. App Database Connection (`apps/cyclist-profile/src/db/index.ts`)

```typescript
import { drizzle } from 'drizzle-orm/node-postgres'
import { Client } from 'pg'
import * as schema from '@atlas/database/schemas/cyclist-profile'

const client = new Client({
  connectionString: process.env.DATABASE_URL
})

await client.connect()

export const db = drizzle(client, { schema })
```

**Purpose:** Service-specific database connection with schema

---

## Summary

### Data Flow

```
Developer writes schema
    ↓
Drizzle generates migration
    ↓
Migration creates PostgreSQL schema + tables
    ↓
App imports schema from database package
    ↓
App connects to database with schema
    ↓
Drizzle provides type-safe query API
    ↓
Handler uses db.query.* to fetch data
    ↓
TypeScript ensures type safety
    ↓
Response sent to client
```

### Key Principles

1. **Single Source of Truth**: All schemas in `packages/database/`
2. **Type Safety**: TypeScript types inferred from schema
3. **Schema Isolation**: Each service owns a PostgreSQL schema
4. **Centralized Migrations**: All migrations in database package
5. **Fast Builds**: No database required for TypeScript compilation
6. **CI/CD Integration**: OpenAPI generated with real database

### Environment Variables

Only one variable needed:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/atlas
```

All services connect to the same database, different schemas.

---

For more details, see:
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Development guide
- [packages/database/USAGE.md](./packages/database/USAGE.md) - Database usage
- [MIGRATION_TO_SHARED_DB.md](./MIGRATION_TO_SHARED_DB.md) - Migration guide

