# Steps for Creating New Database Schema and Seed

## Overview
Generic guide for creating database schemas and seed files for any new service in the Atlas project.

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

### 4. Database Connection
- **Location**: `/apps/{service-name}/src/db/index.ts`
- **Pattern**: Follow cyclist-profile pattern
- **Key Points**:
  - Use `getSSLConfig()` for production, `ssl: false` for local dev
  - Import schema from shared package
  - Use pg Client with drizzle

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

### New Files:
- `/packages/database/src/schemas/{service-name}/schema.ts`
- `/packages/database/src/schemas/{service-name}/index.ts`
- `/apps/{service-name}/src/db/seed.ts`
- `/apps/{service-name}/src/db/migrate.ts`

### Files to Modify:
- `/packages/database/package.json` (add export path and db:drop script)
- `/apps/{service-name}/package.json` (add db scripts)
- `/apps/{service-name}/src/db/index.ts` (update connection pattern)

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

### 7. API Creation
- **Pattern**: Follow cyclist-counts API structure exactly
- **Structure**: Create separate folders for each resource type
  - `/routes/{resource}/` (e.g., calls, analytics, municipalities)
  - Each folder: `{resource}.routes.ts`, `{resource}.handlers.ts`, `{resource}.index.ts`
- **Key Points**:
  - Use OpenAPI schemas with Zod validation
  - Implement filtering, pagination, and sorting
  - Create analytics endpoints based on SQL queries
  - Follow RESTful conventions
  - Use typed handlers with proper error handling
- **Endpoints Created**:
  - `GET /v1/calls` - List calls with filters
  - `GET /v1/calls/{id}` - Get specific call
  - `GET /v1/analytics/municipalities` - Municipality stats
  - `GET /v1/analytics/accident-types` - Accident type stats
  - `GET /v1/analytics/gender-distribution` - Gender distribution
  - `GET /v1/analytics/dangerous-streets` - Most dangerous streets

### 8. OpenAPI Documentation Generation
- **Generate spec**: Run `npx tsx src/generate-openapi.ts` in app directory
- **Copy to docs**: `cp apps/{service-name}/openapi.json apps/docs/public/openapi/{service-name}.json`
- **Update index**: Add entry to `/apps/docs/public/openapi/index.json`
- **Access docs**: Visit `http://localhost:3001/?api={service-name}-api`
- **Commands**:
  ```bash
  # Generate and copy OpenAPI spec
  cd apps/{service-name}
  npx tsx src/generate-openapi.ts
  cp openapi.json ../docs/public/openapi/{service-name}.json
  ```

### 9. Testing Implementation
- **Location**: `/apps/{service-name}/test/{service-name}.spec.ts`
- **Pattern**: Follow cyclist-counts test structure
- **Key Points**:
  - Use Vitest with proper database configuration
  - Test all endpoints with different scenarios
  - Include pagination, filtering, and error handling tests
  - Use `atlas_dev` database for tests (not `atlas`)
  - Test both success and error responses
- **Test Categories**:
  - Health check endpoint
  - CRUD operations with proper status codes
  - Filtering and pagination functionality
  - Analytics endpoints with data validation
  - Error handling for invalid requests
- **Commands**:
  ```bash
  # Run tests for specific service
  pnpm --filter @atlas/{service-name} test
  
  # Run all tests
  pnpm test
  ```
- **Configuration**: Update `vitest.config.ts` to use correct database name and environment

### 10. Code Quality Checks
- **Lint**: Run `pnpm lint` to check code quality
- **Common Issues**:
  - Missing radix parameter in `parseInt()` - add `10` as second parameter
  - Unused variables - prefix with underscore (`_error`)
  - `any` types - replace with proper types like `Record<string, string | null>`
  - Biome ignore comments - replace `<explanation>` with actual explanation
  - Schema version mismatch - update biome.json schema URL to match CLI version
- **Type Check**: Run `pnpm check-types` to verify TypeScript types
- **Format**: Run `pnpm format` to auto-format code

## Expected Result
✅ Database schema created and data successfully seeded
✅ Comprehensive SQL queries created for data validation and exploration
✅ RESTful API created following project patterns with OpenAPI documentation
✅ API documentation available in docs app with interactive interface
✅ Comprehensive test suite implemented and passing for all endpoints
✅ Code quality checks passing (lint, type-check, format)