# Using the Shared Database Package

This guide explains how to use the `@atlas/database` package in your Atlas applications.

## Overview

The `@atlas/database` package provides a centralized database management system for the Atlas monorepo. It uses:
- **Single Database**: All services connect to the same `atlas` database
- **Public Schema**: All tables reside in the default `public` schema
- **Shared Drizzle ORM**: Common database utilities and type-safe queries
- **Cross-Service Queries**: Services can query each other's tables when needed

## Quick Start

### 1. Add the Package Dependency

In your app's `package.json`:

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

### 2. Create Your Database Connection

Create a `src/db/index.ts` file:

```typescript
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

**Note**: This uses top-level await, which requires:
- Node.js 14.8+ with `"type": "module"` in package.json
- The database to be available when the module is imported
- For build processes that don't need the database (like OpenAPI generation), handle this in CI/CD

### 3. Re-export Your Schema

Create a `src/db/schema.ts` file:

```typescript
// Re-export everything from the shared database schema
export * from '@atlas/database/schemas/your-service'
```

### 4. Use the Database in Your Handlers

```typescript
import { db } from '../../db/index.js'

export const list = async (c) => {
  const items = await db.query.yourTable.findMany()
  return c.json(items)
}
```

## Adding a New Service Tables

### 1. Create Schema Files

Create your schema in `packages/database/src/schemas/your-service/`:

```
packages/database/src/schemas/your-service/
├── index.ts
└── schema.ts
```

**schema.ts**:
```typescript
import { jsonb, pgTable, serial, timestamp } from 'drizzle-orm/pg-core'
import { createSelectSchema, createInsertSchema } from 'drizzle-zod'

// Define tables in the public schema
// Use descriptive table names to indicate ownership
export const yourServiceTable = pgTable('your_service_items', {
  id: serial('id').primaryKey(),
  data: jsonb('data').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
})

// Generate Zod schemas for validation
export const selectYourTableSchema = createSelectSchema(yourServiceTable)
export const insertYourTableSchema = createInsertSchema(yourServiceTable)

// Export TypeScript types
export type YourTableRow = typeof yourServiceTable.$inferSelect
export type NewYourTableRow = typeof yourServiceTable.$inferInsert
```

**index.ts**:
```typescript
export * from './schema.js'
```

### 2. Add Export to Database Package

In `packages/database/package.json`, add your schema to exports:

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./schemas/your-service": {
      "types": "./dist/schemas/your-service/index.d.ts",
      "import": "./dist/schemas/your-service/index.js"
    }
  }
}
```

### 3. Generate Migrations

After creating your schema, generate migrations:

```bash
pnpm --filter @atlas/database db:generate
```

### 4. Build the Package

```bash
pnpm --filter @atlas/database build
```

## Database Migrations

### Generate Migrations

```bash
pnpm --filter @atlas/database db:generate
```

### Run Migrations

```bash
pnpm --filter @atlas/database db:migrate
```

### Open Drizzle Studio

```bash
pnpm --filter @atlas/database db:studio
```

## Environment Variables

Each service needs this environment variable:

```env
# Database connection string
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/atlas
```

This is used by both the application and Drizzle Kit for migrations.

## Cross-Service Queries

Services can query other services' tables:

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

// Query your own tables
const yourData = await db.query.yourTable.findMany()

// Query another service's tables
const otherData = await db.query.otherTable.findMany()

// Join across services
import { eq } from 'drizzle-orm'
const joined = await db
  .select()
  .from(yourSchema.yourTable)
  .leftJoin(otherSchema.otherTable, eq(yourSchema.yourTable.id, otherSchema.otherTable.yourId))
```

## Best Practices

1. **Table Naming**: Use clear, descriptive table names that indicate ownership (e.g., `cyclist_profiles`, `analytics_events`)
2. **Table Ownership**: Each service should primarily work with its own tables
3. **Cross-Service Queries**: Use sparingly and document dependencies
4. **Migrations**: Always generate and run migrations through the shared package
5. **Type Safety**: Leverage TypeScript types exported from schemas
6. **Build vs Runtime**: Keep builds database-independent; generate OpenAPI in CI/CD

## Build and OpenAPI Generation

### Local Development

```bash
# Build (no database needed)
pnpm build

# Generate OpenAPI (requires database)
pnpm --filter @atlas/your-service generate-openapi
```

### CI/CD

OpenAPI specs are automatically generated in CI/CD:
1. Build completes (no database)
2. PostgreSQL service starts
3. Migrations run
4. OpenAPI specs generate
5. Specs commit to repository

See [CI/CD Workflows README](../../.github/workflows/README.md) for details.

## Troubleshooting

### Build Fails with Database Error

**Problem**: Build tries to connect to database

**Solution**: Ensure your build script is just `"build": "tsc"` and doesn't include `generate-openapi`

### Type Errors with db.query

Make sure you're importing the schema correctly:

```typescript
import * as schema from '@atlas/database/schemas/your-service'
export const db = drizzle(client, { schema })
```

### Database Connection Issues

Check that:
1. PostgreSQL is running
2. The `atlas` database exists
3. DATABASE_URL is correctly set
4. Migrations have been run to create your tables

