# OpenAPI Specification Workflow

This document explains how OpenAPI specifications are generated and managed in the Atlas monorepo.

## Overview

OpenAPI specs are **generated as part of the build process** and treated as build artifacts. This is the standard pattern for monorepos using Turborepo.

## Workflow

### 1. Local Development

```bash
# Generate OpenAPI specs for all services
pnpm build

# Or for a specific service
pnpm --filter @atlas/cyclist-profile build

# The specs are generated to: apps/docs/public/openapi/
```

**What happens:**
1. Turbo runs `generate-openapi` task (configured in `turbo.json`)
2. Each service's `src/generate-openapi.ts` script runs
3. Specs are written to `apps/docs/public/openapi/{service-name}.json`
4. Then the TypeScript build runs

### 2. CI/CD Pipeline

```yaml
# .github/workflows/ci.yml

build:
  - Setup PostgreSQL (needed for DB connection during OpenAPI generation)
  - Run database migrations
  - Run: pnpm build --affected
    → This generates OpenAPI specs automatically
  - Upload build artifacts (dist/ folders + OpenAPI specs)
```

**Key points:**
- PostgreSQL is required because services connect to DB at import time
- Migrations run before build to ensure DB schema is up-to-date
- OpenAPI generation happens automatically as part of build
- No separate "generate-openapi" job needed

### 3. Docker Build

```yaml
# .github/workflows/docker.yml

build_and_push:
  - Checkout code
  - Build Docker image
    → Dockerfile copies pre-generated OpenAPI specs
```

**Key points:**
- OpenAPI specs are already generated (from CI build step)
- Docker just copies them into the image
- No need to install Node.js, pnpm, or run generation in Docker build

## Configuration

### Turborepo (`turbo.json`)

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build", "generate-openapi"]
    },
    "generate-openapi": {
      "dependsOn": ["^build"],
      "cache": false
    }
  }
}
```

**Dependency chain:**
1. `@atlas/database` builds first (dependency)
2. `generate-openapi` runs (depends on database being built)
3. `build` runs (depends on generate-openapi)

### Service Package.json

```json
{
  "scripts": {
    "build": "tsc && pnpm generate-openapi",
    "generate-openapi": "tsx src/generate-openapi.ts"
  }
}
```

### Generate OpenAPI Script

Each service has `src/generate-openapi.ts`:

```typescript
import app from "./app.js";

const openAPIDoc = app.getOpenAPIDocument({
  openapi: "3.1.0",
  info: { title: "Service API", version: "1.0.0" }
});

fs.writeFileSync(
  "../../docs/public/openapi/service-name.json",
  JSON.stringify(openAPIDoc, null, 2)
);
```

## Why This Approach?

### ✅ Advantages

1. **Simple** - OpenAPI generation is just part of the build
2. **Consistent** - Same process locally and in CI
3. **Fast** - Leverages Turbo's caching and dependency graph
4. **Reliable** - Specs are always in sync with code
5. **Standard** - Follows monorepo best practices

### ❌ Previous Complex Approach

The old approach had:
- Separate `generate-openapi` CI job
- Complex artifact passing between jobs
- OpenAPI generation in Docker builds
- Conditional logic for which specs to generate
- Multiple places where specs were generated

This led to:
- Failures when artifacts were missing
- Inconsistent spec generation
- Slower builds
- More complex debugging

## Troubleshooting

### OpenAPI specs not generated

```bash
# Check if database is running (required for generation)
docker compose up postgres -d

# Build with verbose output
pnpm build --filter=@atlas/cyclist-profile --verbose

# Check the generate-openapi script directly
pnpm --filter @atlas/cyclist-profile generate-openapi
```

### Database connection errors during build

The services connect to PostgreSQL at import time, so you need:

```bash
# Set DATABASE_URL
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/atlas

# Or use .env file
cp apps/cyclist-profile/.env.example apps/cyclist-profile/.env
```

### Specs not in Docker image

Check the Dockerfile copies the specs:

```dockerfile
# Copy OpenAPI specs
COPY apps/docs/public/openapi ./apps/docs/public/openapi
```

## Best Practices

1. **Always run build locally before committing** - Ensures specs are up-to-date
2. **Commit generated specs to git** - They're part of the build output
3. **Don't manually edit generated specs** - They'll be overwritten
4. **Keep generate-openapi.ts simple** - Just generate and write the file

## Related Files

- `turbo.json` - Configures build dependencies
- `.github/workflows/ci.yml` - CI build process
- `.github/workflows/docker.yml` - Docker image builds
- `apps/*/src/generate-openapi.ts` - Generation scripts
- `apps/docs/public/openapi/` - Generated specs location

