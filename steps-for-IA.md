# Manual Database Setup Guide

## Overview
Guide for manually creating database schemas and seed files when the automated scaffolding tool doesn't fit your needs. For most cases, use `pnpm create-atlas-app` instead.

## When to Use This Guide

### ✅ Use Manual Approach When:
- Adding database functionality to existing services
- Working with complex data imports (TSV, CSV files)
- Creating custom database schemas not covered by scaffolding
- Understanding the manual process for troubleshooting
- Service already exists but needs database integration

### 🚀 Use Automated Scaffolding When:
- Creating a completely new service
- Need standard API structure with database
- Want best practices built-in
- Need Docker, tests, and CI/CD integration

## Quick Start (Recommended for New Services)
```bash
pnpm create-atlas-app my-service
```
See [CREATE_NEW_SERVICE.md](docs/CREATE_NEW_SERVICE.md) and [SCAFFOLDING_TOOL.md](docs/SCAFFOLDING_TOOL.md) for details.

## Key Steps

### 1. Schema Creation
- **Location**: `/packages/database/src/schemas/{service-name}/schema.ts`
- **Pattern**: Follow existing schemas (cyclist-profile, cyclist-counts)
- **Key Points**:
  - Use `pgTable` with descriptive field names
  - Make fields nullable when data might be missing
  - Include `created_at` and `updated_at` timestamps
  - Export Zod schemas and TypeScript types

### 2. Package.json Updates
- **Database package**: Add export path for new schema
- **App package**: Add `db:migrate` and `db:seed` scripts

### 3. Seed File Creation
- **Location**: `/apps/{service-name}/src/db/seed.ts`
- **Pattern**: Use `createConnectedDatabase()` and `closeDatabase()` from `@atlas/database`
- **Key Points**:
  - Import schema from shared package: `@atlas/database/schemas/{service-name}`
  - Use `import.meta.dirname` for file paths
  - Process data in batches (recommended: 100 records)
  - Handle data type conversions (string to int, dates)
  - Handle null/empty values properly

### 4. Database Connection (For Existing Services)
- **Location**: `/apps/{service-name}/src/db/index.ts`
- **Pattern**: Follow cyclist-profile or emergency-calls pattern
- **Key Points**:
  - Use `createConnectedDatabase()` from `@atlas/database`
  - Import schema from shared package: `@atlas/database/schemas/{service-name}`

### 5. Migration Workflow
```bash
# When schema changes are needed:
pnpm --filter @atlas/database db:drop    # Drop existing migration
pnpm --filter @atlas/database db:generate # Generate new migration
pnpm --filter @atlas/database db:migrate  # Apply migration
pnpm --filter @atlas/{service-name} db:seed # Seed data
```

## Critical Commands That Worked

1. **Build database package first**:
   ```bash
   pnpm --filter @atlas/database build
   ```

2. **Drop and regenerate when schema changes**:
   ```bash
   pnpm --filter @atlas/database db:drop
   pnpm --filter @atlas/database db:generate
   pnpm --filter @atlas/database db:migrate
   ```

3. **Seed from app**:
   ```bash
   pnpm --filter @atlas/{service-name} db:seed
   ```

## Key Learnings

1. **Schema Design**: Make fields nullable when TSV data might have empty values
2. **Import Patterns**: Always import from shared database package, not local files
3. **Connection Management**: Use `createConnectedDatabase()` pattern for consistency
4. **File Paths**: Use `import.meta.dirname` instead of `__dirname`
5. **Batch Processing**: Process large datasets in batches for performance
6. **Error Handling**: Handle data type conversions and null values gracefully

## Files to Create/Modify

### For Existing Services (Manual Setup):
- `/packages/database/src/schemas/{service-name}/schema.ts`
- `/packages/database/src/schemas/{service-name}/index.ts`
- `/apps/{service-name}/src/db/seed.ts`
- `/apps/{service-name}/src/db/migrate.ts`

### Files to Modify:
- `/packages/database/package.json` (add export path)
- `/apps/{service-name}/package.json` (add db scripts if missing)

### 6. Database Validation
- **Location**: `/apps/{service-name}/src/db/random-queries.sql`
- **Purpose**: Test data quality and explore dataset
- **Key Queries**:
  - Basic counts and overviews
  - Top categories and distributions
  - Demographic/temporal analysis
  - Geographic analysis
  - Data quality checks (null values)
- **Usage**: Run in `pnpm --filter @atlas/database db:studio` or direct PostgreSQL connection

### 7. API Creation (If Not Using Scaffolding Tool)
- **Pattern**: Follow cyclist-counts or emergency-calls API structure
- **Structure**: Create separate folders for each resource type
  - `/routes/{resource}/` (e.g., calls, analytics, municipalities)
  - Each folder: `{resource}.routes.ts`, `{resource}.handlers.ts`, `{resource}.index.ts`
- **Key Points**:
  - Use OpenAPI schemas with Zod validation
  - Implement filtering, pagination, and sorting
  - Create analytics endpoints based on SQL queries
  - Follow RESTful conventions
  - Use typed handlers with proper error handling
- **Note**: The scaffolding tool (`pnpm create-atlas-app`) generates this structure automatically

### 8. OpenAPI Documentation Generation
- **Generate spec**: `pnpm --filter @atlas/{service-name} generate-openapi`
- **Copy to docs**: `cp apps/{service-name}/openapi.json apps/docs/public/openapi/{service-name}.json`
- **Update index**: Add entry to `/apps/docs/public/openapi/index.json`
- **Access docs**: Visit `http://localhost:3001/?api={service-name}-api`
- **Note**: The scaffolding tool includes `generate-openapi.ts` automatically

### 9. Testing Implementation (If Not Using Scaffolding Tool)
- **Location**: `/apps/{service-name}/test/{service-name}.spec.ts`
- **Pattern**: Follow cyclist-counts or emergency-calls test structure
- **Key Points**:
  - Use Vitest with proper database configuration
  - Test all endpoints with different scenarios
  - Include pagination, filtering, and error handling tests
  - Use `atlas_dev` database for tests (not `atlas`)
  - Test both success and error responses
- **Commands**:
  ```bash
  pnpm --filter @atlas/{service-name} test
  ```
- **Note**: The scaffolding tool generates test files and configuration automatically

### 10. Code Quality Checks
- **Commands**:
  ```bash
  pnpm lint          # Check code quality
  pnpm check-types   # Verify TypeScript types
  pnpm format        # Auto-format code
  ```
- **Common Issues**:
  - Missing radix parameter in `parseInt()` - add `10` as second parameter
  - Unused variables - prefix with underscore (`_error`)
  - `any` types - replace with proper types like `Record<string, string | null>`
  - Use named imports: `import { Client } from "pg"` not default
  - Add type assertions for query results: `result.rows as { field: type }[]`

## Expected Result
✅ Database schema created and data successfully seeded
✅ Comprehensive SQL queries created for data validation and exploration
✅ RESTful API created following project patterns (if applicable)
✅ OpenAPI documentation generated and integrated (if applicable)
✅ Test suite implemented and passing (if applicable)
✅ Code quality checks passing (lint, type-check, format)

## Related Documentation
- [CREATE_NEW_SERVICE.md](docs/CREATE_NEW_SERVICE.md) - Complete guide for new services
- [SCAFFOLDING_TOOL.md](docs/SCAFFOLDING_TOOL.md) - Automated service generation
- [Database Usage Guide](packages/database/USAGE.md) - Database patterns and best practices