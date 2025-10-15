# @atlas/database

Shared database package for the Atlas monorepo, providing centralized database connection management, schema organization, and migration coordination using Drizzle ORM.

## Features

- **Centralized Connection Management**: Single database connection configuration for all services
- **Schema Separation**: Each service owns its PostgreSQL schema within the shared `atlas` database
- **Cross-Service Queries**: Services can query each other's schemas when needed
- **Migration Coordination**: Centralized migration management with service-specific organization
- **Type Safety**: Full TypeScript support with Drizzle ORM

## Architecture

The package organizes the database using PostgreSQL schemas:

```
atlas (database)
├── cyclist_profile (schema)
│   └── cyclist_profiles (table)
├── analytics (schema)
│   └── analytics_events (table)
└── notifications (schema)
    └── notification_queue (table)
```

Each service gets its own PostgreSQL schema, allowing:
- Clear separation of concerns
- Independent schema evolution
- Cross-service queries when needed
- Simplified backup and maintenance

## Usage

### Basic Setup

```typescript
import { createDatabase, schemaManager } from "@atlas/database";

// Create database connection
const db = createDatabase({
  connectionString: process.env.DATABASE_URL,
});

// Connect to database
await db.client.connect();
```

### Service-Specific Schema

```typescript
import { schemaManager } from "@atlas/database";

// Get schema for your service
const myServiceSchema = schemaManager.getSchema("my-service");

// Define tables in your service's schema
export const myTable = myServiceSchema.table("my_table", {
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

# Open Drizzle Studio
pnpm db:studio

# Generate new migrations
pnpm db:generate
```

## Adding a New Service Schema

1. Create your schema directory:
   ```
   packages/database/src/schemas/my-service/
   ```

2. Define your schema:
   ```typescript
   // packages/database/src/schemas/my-service/schema.ts
   import { schemaManager } from "../../schema-manager.js";
   
   const myServiceSchema = schemaManager.getSchema("my-service");
   
   export const myTable = myServiceSchema.table("my_table", {
     // your table definition
   });
   ```

3. Export your schema:
   ```typescript
   // packages/database/src/schemas/my-service/index.ts
   export * from "./schema.js";
   ```

4. Update the drizzle config to include your schema in the `schemaFilter`.

## Migration Strategy

- All migrations are stored in `packages/database/src/migrations`
- Migrations are generated using `drizzle-kit generate`
- Run migrations using `pnpm db:migrate` from the database package
- Each service's tables are created in their respective PostgreSQL schema

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
