# Atlas Database Schema Organization Strategy

## Overview

The Atlas monorepo uses a single PostgreSQL database named `atlas` with a single `public` schema for all tables. This approach provides:

- **Centralized Management**: Single database instance to manage
- **Simplified Queries**: No need to specify schema names
- **Shared Tables**: Services can query each other's tables when needed
- **Simplified Operations**: Backup, monitoring, and maintenance of one database
- **Standard Practice**: Uses PostgreSQL's default public schema

## Database Structure

```
atlas (database)
└── public (default schema)
    ├── cyclist_profiles
    ├── events (future)
    ├── notification_queue (future)
    └── users (future)
```

## Naming Convention

- **Service Names**: Use kebab-case in code (`cyclist-profile`, `user-auth`)
- **Table Names**: Use snake_case with descriptive names (`cyclist_profiles`, `notification_queue`)

## Migration Strategy

### Phase 1: Create Shared Database Package ✅
- [x] Create `@atlas/database` package
- [x] Set up connection management
- [x] Define migration coordination
- [x] Migrate to single public schema

### Phase 2: Migrate Existing Services ✅
1. **Cyclist Profile Service**:
   - Migrated to `atlas` database with public schema
   - Updated connection configuration
   - Updated application code

### Phase 3: Update Scaffolding
- Update `create-atlas-app` to use shared database
- Generate service-specific table definitions
- Update templates and documentation

## Service Table Management

Each service will:

1. **Define its tables** in `packages/database/src/schemas/{service-name}/`
2. **Own its tables** within the public schema
3. **Manage its migrations** through the centralized system
4. **Export types** for other services to use

### Example Service Schema

```typescript
// packages/database/src/schemas/cyclist-profile/schema.ts
import { pgTable, serial, jsonb, timestamp } from "drizzle-orm/pg-core";

export const cyclistProfiles = pgTable("cyclist_profiles", {
  id: serial("id").primaryKey(),
  data: jsonb("data").notNull(),
  metadata: jsonb("metadata").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});
```

### Service Usage

```typescript
// apps/cyclist-profile/src/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import * as schema from "@atlas/database/schemas/cyclist-profile";

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});
await client.connect();

export const db = drizzle(client, { schema });
```

## Cross-Service Queries

Services can import and query other tables:

```typescript
import { cyclistProfiles } from "@atlas/database/schemas/cyclist-profile";
import { events } from "@atlas/database/schemas/analytics";

// Analytics service querying cyclist data
const profileAnalytics = await db
  .select()
  .from(events)
  .leftJoin(cyclistProfiles, eq(events.userId, cyclistProfiles.id))
  .where(eq(events.eventType, "profile_view"));
```

## Migration Coordination

### Centralized Migrations
- All migrations stored in `packages/database/src/migrations/`
- Generated using `drizzle-kit generate` from the database package
- Applied using shared migration runner

### Service-Specific Migrations
- Each service's schema changes generate migrations
- Migrations include schema creation statements
- Cross-service dependencies handled through proper ordering

### Migration Commands
```bash
# Generate migrations for all schemas
cd packages/database
pnpm db:generate

# Apply all migrations
pnpm db:migrate

# Open Drizzle Studio (shows all schemas)
pnpm db:studio
```

## Environment Configuration

### Shared Configuration
```bash
# Single database for all services
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/atlas

# Or individual components
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=atlas
DB_SSL=false
```

### Service-Specific Overrides
Services can override connection settings if needed:

```typescript
const db = createDatabase({
  database: "atlas_test", // Use test database
  schema: myServiceSchema,
});
```

## Benefits

1. **Simplified Operations**: One database to backup, monitor, and maintain
2. **Better Performance**: Cross-service queries don't require network calls
3. **Consistent Tooling**: Single Drizzle Studio instance shows all data
4. **Easier Development**: Developers can see the full data model
5. **Atomic Transactions**: Cross-service operations can be transactional

## Considerations

1. **Schema Conflicts**: Service names must be unique
2. **Migration Coordination**: Changes affecting multiple services need coordination
3. **Access Control**: Use application-level permissions, not database-level
4. **Backup Strategy**: Full database backups include all services
5. **Scaling**: Monitor for resource contention between services

## Implementation Timeline

1. **Week 1**: Create shared database package ✅
2. **Week 1**: Migrate cyclist-profile service
3. **Week 2**: Update create-atlas-app generator
4. **Week 2**: Update documentation and examples
5. **Week 3**: Migrate any future services to use shared database

## Rollback Plan

If issues arise:
1. Services can temporarily use individual databases
2. Connection configuration supports both approaches
3. Schema exports remain compatible
4. Migration history is preserved
