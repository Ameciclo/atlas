# Migration to Shared Database Package

This document explains the migration from individual database setups to a shared database package with PostgreSQL schemas.

## What Changed

### Before (Individual Databases)

```
cyclist-profile-service → cyclist_profile_db (separate database)
analytics-service → analytics_db (separate database)
```

Each service had:
- Its own database
- Its own Drizzle configuration
- Its own schema files
- Its own migrations

### After (Shared Database with PostgreSQL Schemas)

```
atlas database
├── cyclist_profile schema (owned by cyclist-profile service)
├── analytics schema (owned by analytics service)
└── notifications schema (owned by notifications service)
```

All services:
- Connect to the same `atlas` database
- Use PostgreSQL schemas for isolation
- Share Drizzle configuration from `@atlas/database`
- Can query across schemas when needed

## Architecture

### Package Structure

```
packages/database/
├── src/
│   ├── schemas/
│   │   ├── cyclist-profile/
│   │   │   ├── index.ts
│   │   │   └── schema.ts
│   │   └── [other-services]/
│   ├── migrations/
│   ├── connection.ts
│   ├── schema-manager.ts
│   ├── migrate.ts
│   └── index.ts
├── drizzle.config.ts
└── package.json
```

### Service Structure

```
apps/cyclist-profile/
├── src/
│   ├── db/
│   │   ├── index.ts (database connection)
│   │   └── schema.ts (re-exports from @atlas/database)
│   └── ...
└── package.json (depends on @atlas/database)
```

## Key Benefits

1. **Single Source of Truth**: All schemas in one place
2. **Cross-Service Queries**: Services can query each other's data
3. **Simplified Deployment**: One database to manage
4. **Type Safety**: Shared types across services
5. **Consistent Migrations**: Centralized migration management

## Database Connection Pattern

### Simple Approach (Current)

```typescript
// apps/your-service/src/db/index.ts
import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import pkg from 'pg'
const { Client } = pkg
import * as schema from '@atlas/database/schemas/your-service'

const client = new Client({
  connectionString: process.env.DATABASE_URL
})

await client.connect()

export const db = drizzle(client, { schema })
```

**Pros:**
- ✅ Simple and straightforward
- ✅ Full TypeScript type inference
- ✅ Standard Drizzle pattern

**Cons:**
- ⚠️ Connects immediately on import
- ⚠️ Requires database for any module import

### Why Not Use a Proxy?

We initially considered a Proxy pattern to defer database connection, but decided against it because:

1. **Complexity**: Adds unnecessary complexity for minimal benefit
2. **CI/CD Solution**: We handle database-less builds in CI/CD instead
3. **Standard Pattern**: The simple approach is more familiar to developers
4. **Performance**: No proxy overhead

## OpenAPI Generation Strategy

### Problem

OpenAPI generation needs to import route handlers, which import the database connection. But we don't want to require a database for builds.

### Solution: Generate in CI/CD

**Local Development:**
```bash
# Build (no database needed)
pnpm build

# Generate OpenAPI manually (requires database)
pnpm --filter @atlas/cyclist-profile generate-openapi
```

**CI/CD Pipeline:**
```
1. Build TypeScript (no database)
2. Start PostgreSQL service
3. Run migrations
4. Generate OpenAPI specs
5. Commit specs to repository
```

### Benefits

- ✅ Builds are fast and database-independent
- ✅ OpenAPI specs are always up-to-date in the repo
- ✅ Specs generated with real database schema
- ✅ No complex workarounds needed

## Migration Steps for New Services

### 1. Add Database Package Dependency

```json
{
  "dependencies": {
    "@atlas/database": "workspace:*",
    "drizzle-orm": "^0.43.1",
    "pg": "^8.14.1"
  },
  "devDependencies": {
    "@types/pg": "^8.11.13"
  }
}
```

### 2. Create Schema in Database Package

```typescript
// packages/database/src/schemas/your-service/schema.ts
import { pgTable, serial, timestamp } from 'drizzle-orm/pg-core'
import { createSchemaManager } from '../../schema-manager.js'

const schemaManager = createSchemaManager()
const yourServiceSchema = schemaManager.getSchema('your-service')

export const yourTable = pgTable('your_table', {
  id: serial('id').primaryKey(),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  schema: yourServiceSchema
}))
```

### 3. Update Service Database Connection

```typescript
// apps/your-service/src/db/index.ts
import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import pkg from 'pg'
const { Client } = pkg
import * as schema from '@atlas/database/schemas/your-service'

const client = new Client({
  connectionString: process.env.DATABASE_URL
})

await client.connect()

export const db = drizzle(client, { schema })
```

### 4. Update Package.json Scripts

```json
{
  "scripts": {
    "build": "tsc",
    "db:generate": "pnpm --filter @atlas/database db:generate",
    "db:migrate": "pnpm --filter @atlas/database db:migrate",
    "generate-openapi": "tsx src/generate-openapi.ts"
  }
}
```

### 5. Update CI/CD Workflow

Add your service to `.github/workflows/ci.yml`:

```yaml
- name: Generate OpenAPI specs for affected apps
  env:
    DATABASE_URL: postgresql://postgres:postgres@localhost:5432/atlas
  run: |
    if pnpm turbo run generate-openapi --filter=@atlas/your-service --dry=json | grep -q "your-service"; then
      pnpm --filter @atlas/your-service generate-openapi
    fi
```

## Environment Variables

### Development

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/atlas
```

### Production

```env
DATABASE_URL=postgresql://user:password@host:5432/atlas
```

## Common Patterns

### Querying Your Own Schema

```typescript
import { db } from '../db/index.js'

const profiles = await db.query.cyclistProfiles.findMany()
```

### Cross-Service Queries

```typescript
import { drizzle } from 'drizzle-orm/node-postgres'
import * as yourSchema from '@atlas/database/schemas/your-service'
import * as otherSchema from '@atlas/database/schemas/other-service'

const db = drizzle(client, {
  schema: {
    ...yourSchema,
    ...otherSchema
  }
})

// Query your schema
const yourData = await db.query.yourTable.findMany()

// Query other service's schema
const otherData = await db.query.otherTable.findMany()
```

## Troubleshooting

### Build Fails with Database Error

**Problem**: `DATABASE_URL environment variable is not set`

**Solution**: Make sure your build script doesn't include `generate-openapi`:
```json
{
  "scripts": {
    "build": "tsc"  // ✅ Correct
    // "build": "tsc && pnpm generate-openapi"  // ❌ Wrong
  }
}
```

### OpenAPI Generation Fails Locally

**Problem**: Can't connect to database

**Solution**: Ensure database is running and migrated:
```bash
docker-compose up -d postgres
pnpm --filter @atlas/database db:migrate
pnpm --filter @atlas/your-service generate-openapi
```

### Type Errors with db.query

**Problem**: `Property 'yourTable' does not exist on type '{}'`

**Solution**: Make sure you're passing the schema to drizzle:
```typescript
export const db = drizzle(client, { schema })  // ✅ Correct
// export const db = drizzle(client)  // ❌ Wrong
```

## Related Documentation

- [Database Package Usage](./packages/database/USAGE.md)
- [Database Schema Strategy](./packages/database/SCHEMA_STRATEGY.md)
- [CI/CD Workflows](./.github/workflows/README.md)

