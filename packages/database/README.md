# @atlas/database

Shared database package for the Atlas monorepo, providing centralized database connection management, schema organization, and migration coordination using Drizzle ORM.

## Features

- **Centralized Connection Management**: Single database connection configuration for all services
- **Schema Separation**: Each service owns its PostgreSQL schema within the shared `atlas` database
- **Cross-Service Queries**: Services can query each other's schemas when needed
- **Migration Coordination**: Centralized migration management with service-specific organization
- **Type Safety**: Full TypeScript support with Drizzle ORM

## Architecture

The package organizes the database using a single public schema:

```
atlas (database)
└── public (schema)
    ├── cyclist_profiles (table)
    ├── analytics_events (table - future)
    └── notification_queue (table - future)
```

All services use the default `public` schema, allowing:
- Simplified queries (no schema prefixes needed)
- Clear table ownership through naming
- Cross-service queries when needed
- Simplified backup and maintenance

## Quick Start

### Development

```bash
# 1. Start database
pnpm --filter @atlas/docker-dev dev

# 2. Run migrations
pnpm --filter @atlas/database db:migrate

# 3. Seed with real data (optional)
pnpm --filter @atlas/database db:seed

# Or reset everything (migrate + seed)
pnpm --filter @atlas/database db:reset
```

### Production

```bash
# Run migrations
DATABASE_URL=postgresql://user:pass@host:5432/dbname pnpm --filter @atlas/database db:migrate

# Seed with real data
DATABASE_URL=postgresql://user:pass@host:5432/dbname pnpm --filter @atlas/database db:seed
```

## Usage

### Basic Setup

```typescript
import { createDatabase } from "@atlas/database";

// Create database connection
const db = createDatabase({
  connectionString: process.env.DATABASE_URL,
});

// Connect to database
await db.client.connect();
```

### Defining Tables

```typescript
import { pgTable, serial, text } from "drizzle-orm/pg-core";

// Define tables in the public schema
export const myTable = pgTable("my_table", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});
```

### Using Existing Schemas

```typescript
import { cyclistProfiles } from "@atlas/database/schemas/cyclist-profile";
import { createDatabase } from "@atlas/database";

const db = createDatabase();
await db.client.connect();

// Query cyclist profiles from any service
const profiles = await db.select().from(cyclistProfiles);
```

## Environment Variables

```bash
# Database connection (choose one)
DATABASE_URL=postgresql://user:password@host:port/atlas

# Or individual components
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=atlas
DB_SSL=false
```

## Scripts

```bash
# Build the package
pnpm build

# Run migrations
pnpm db:migrate

# Seed the database
pnpm db:seed

# Reset database (truncate all tables)
pnpm db:reset

# Open Drizzle Studio
pnpm db:studio

# Generate new migrations
pnpm db:generate
```

## Database Seeding

The Atlas database includes a comprehensive seeding system that populates the database with initial data. All seed functions are **idempotent** - they can be run multiple times without creating duplicates.

### Running Seeds

```bash
# Run all seeds
pnpm db:seed

# Run specific seeds
pnpm db:seed --only=counts,profiles

# Skip specific seeds
pnpm db:seed --skip=deaths

# Reset database and seed (truncate + migrate + seed)
pnpm db:reset && pnpm db:migrate && pnpm db:seed
```

### Available Seeds

- **counts** - Cyclist counting data (locations, events, sessions, movements)
- **profiles** - Cyclist profile data (500 profiles from cyclist-profile app)
- **deaths** - Traffic deaths data (from DATASUS CSV files)

### Adding a New Seed Function

1. **Create a seed file** at `packages/database/src/seed-{app-name}.ts`

2. **Use the seed template** as a reference:
   ```bash
   cat packages/database/SEED_TEMPLATE.ts
   ```

3. **Implement your seed function** following these principles:
   - **Idempotency**: Check if data exists before inserting
   - **Error Handling**: Wrap operations in try-catch, continue on errors
   - **Logging**: Use chalk for colored output
   - **Performance**: Batch operations when possible

4. **Register the seed** in `packages/database/src/seed.ts`:
   ```typescript
   import seedMyApp from "./seed-my-app.js";

   const seedTasks = [
     // ... existing tasks
     { id: "my-app", name: "My App", fn: seedMyApp },
   ];
   ```

5. **Test your seed**:
   ```bash
   # Run your seed
   pnpm db:seed --only=my-app

   # Run again to verify idempotency
   pnpm db:seed --only=my-app
   ```

### Seed Data Organization

Seed data files should be organized in `packages/database/seed-data/`:

```
packages/database/seed-data/
├── cyclist-profiles/
│   └── data.json          # 500 cyclist profiles
├── traffic-deaths/
│   └── mortes_transito_*.csv  # Traffic death statistics
└── cyclist-counts/
    └── (data if needed)
```

### Idempotency Patterns

**Simple equality check:**
```typescript
const existing = await db
  .select()
  .from(schema.table)
  .where(eq(schema.table.uniqueField, value))
  .limit(1);

if (existing.length > 0) {
  skipped++;
  continue;
}
```

**JSONB containment check (for complex objects):**
```typescript
const existing = await db
  .select()
  .from(schema.table)
  .where(
    sql`${schema.table.metadata} @> ${JSON.stringify({ id: value })}`
  )
  .limit(1);

if (existing.length > 0) {
  skipped++;
  continue;
}
```

## Adding a New Service Tables

1. Create your schema directory:
   ```
   packages/database/src/schemas/my-service/
   ```

2. Define your tables:
   ```typescript
   // packages/database/src/schemas/my-service/schema.ts
   import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

   export const myTable = pgTable("my_service_table", {
     id: serial("id").primaryKey(),
     name: text("name").notNull(),
     created_at: timestamp("created_at").defaultNow().notNull(),
   });
   ```

3. Export your schema:
   ```typescript
   // packages/database/src/schemas/my-service/index.ts
   export * from "./schema.js";
   ```

4. Generate migrations:
   ```bash
   pnpm --filter @atlas/database db:generate
   ```

## Migration Strategy

- All migrations are stored in `packages/database/src/migrations`
- Migrations are generated using `drizzle-kit generate`
- Run migrations using `pnpm db:migrate` from the database package
- All tables are created in the public schema

## Cross-Service Queries

Services can import and query other services' schemas:

```typescript
import { cyclistProfiles } from "@atlas/database/schemas/cyclist-profile";
import { analyticsEvents } from "@atlas/database/schemas/analytics";

// Join data across services
const result = await db
  .select()
  .from(cyclistProfiles)
  .leftJoin(analyticsEvents, eq(cyclistProfiles.id, analyticsEvents.userId));
```

## Best Practices

1. **Schema Naming**: Use kebab-case for service names, they'll be converted to snake_case for PostgreSQL
2. **Table Naming**: Use snake_case for table names
3. **Cross-Service Queries**: Use sparingly and document dependencies
4. **Migrations**: Always test migrations in development before production
5. **Connection Management**: Always close connections when done

## Development

```bash
# Install dependencies
pnpm install

# Build in watch mode
pnpm dev

# Type checking
pnpm check-types

# Linting
pnpm lint

# Formatting
pnpm format
```
