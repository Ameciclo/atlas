# Contributing to Atlas

Welcome to the Atlas monorepo! This guide will help you add new applications and features to the project.

## Table of Contents

- [Adding a New App](#adding-a-new-app)
- [Database Seeding](#database-seeding)
- [Docker Setup](#docker-setup)
- [CI/CD Integration](#cicd-integration)
- [Documentation](#documentation)

## Adding a New App

### Step 1: Generate App Structure

Use the `create-atlas-app` CLI tool to scaffold a new application:

```bash
pnpm create-atlas-app my-service
```

This command automatically:
- Creates the `apps/my-service/` directory structure
- Generates `package.json` with appropriate dependencies
- Creates database schema in `packages/database/src/schemas/my-service/`
- Updates `packages/database/package.json` exports
- Generates a Dockerfile for containerization

### Step 2: Add Database Seeding (if needed)

If your app requires database seeding:

1. **Create a seed file** at `packages/database/src/seed-my-service.ts`

2. **Use the seed template** as a reference:
   ```bash
   cat packages/database/SEED_TEMPLATE.ts
   ```

3. **Implement your seed function**:
   ```typescript
   import { Database } from "packages/database";
   
   export default async function seedMyService(db: Database) {
     console.log("Seeding my-service...");
     
     try {
       // Your seeding logic here
       // Example:
       // const [location] = await db
       //   .insert(myServiceSchema.locations)
       //   .values({ name: "Downtown" })
       //   .returning();
       
       console.log("✅ my-service seeded successfully");
     } catch (error) {
       console.error("❌ Error seeding my-service:", error);
       throw error;
     }
   }
   ```

4. **Register the seed function** in `packages/database/src/seed.ts`:
   ```typescript
   import seedMyService from "./seed-my-service.js";
   
   const seedTasks = [
     // ... existing tasks
     { id: "my-service", name: "My Service", fn: seedMyService },
   ];
   ```

5. **Test your seed**:
   ```bash
   pnpm db:seed --only=my-service
   ```

### Step 3: Add Docker Service (if needed)

If your app needs to run in Docker Compose:

1. **Update `docker-compose.yml`** in the root directory:
   ```yaml
   my-service:
     build:
       context: .
       dockerfile: apps/my-service/Dockerfile
     ports:
       - "3002:3000"
     environment:
       - DATABASE_URL=postgresql://user:password@postgres:5432/atlas_dev
       - NODE_ENV=development
     depends_on:
       - postgres
   ```

2. **Verify the Dockerfile** exists at `apps/my-service/Dockerfile`

3. **Test the Docker build**:
   ```bash
   docker-compose build my-service
   ```

### Step 4: Update CI/CD Pipeline

Add your app to `.github/workflows/ci.yml`:

```yaml
- name: Build my-service
  run: turbo run build --filter=my-service

- name: Test my-service
  run: turbo run test --filter=my-service
```

### Step 5: Update Documentation

Add your app to `docs/APPS.md`:

```markdown
## My Service

**Port:** 3002  
**Type:** API / Web / Worker  
**Database:** Yes / No

### Description
Brief description of what this app does.

### Key Endpoints
- `GET /health` - Health check
- `POST /api/resource` - Create resource

### Dependencies
- cyclist-counts (if applicable)
- traffic-deaths (if applicable)

### Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV` - Environment (development/production)
```

## Database Seeding

### Running Seeds

```bash
# Run all seeds
pnpm db:seed

# Run specific seeds
pnpm db:seed --only=counts,profiles

# Skip specific seeds
pnpm db:seed --skip=deaths

# Reset database and seed
pnpm db:reset && pnpm db:migrate && pnpm db:seed
```

### Seed Idempotency

All seed functions must be **idempotent** - they should produce the same result when run multiple times without creating duplicates.

**Example of idempotent seeding:**
```typescript
// Check if data already exists
const existing = await db
  .select()
  .from(mySchema.table)
  .where(eq(mySchema.table.uniqueField, value))
  .limit(1);

if (existing.length > 0) {
  console.log("✓ Data already exists, skipping");
  return;
}

// Insert new data
await db.insert(mySchema.table).values(data);
```

### Seed Data Organization

Seed data files should be organized in `packages/database/seed-data/`:

```
packages/database/seed-data/
├── cyclist-profiles/
│   └── data.json
├── traffic-deaths/
│   └── mortes_transito_*.csv
└── cyclist-counts/
    └── (data if needed)
```

## Docker Setup

### Local Development

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f my-service

# Stop services
docker-compose down
```

### Building Images

```bash
# Build specific app
docker build -f apps/my-service/Dockerfile -t atlas/my-service:latest .

# Build all apps
docker-compose build
```

## CI/CD Integration

The project uses GitHub Actions for CI/CD. Key workflows:

- **ci.yml** - Runs on every push (build, test, lint)
- **deploy.yml** - Runs on main branch (deploy to staging/production)

Your app will automatically be included if you:
1. Add it to the monorepo via `create-atlas-app`
2. Update `.github/workflows/ci.yml` with build/test steps

## Documentation

### Code Comments

- Use JSDoc for functions and classes
- Explain the "why", not the "what"
- Keep comments up-to-date with code changes

### README Files

Each app should have a `README.md` with:
- Description of the app
- How to run it locally
- Key endpoints/features
- Dependencies
- Environment variables

### API Documentation

Use OpenAPI/Swagger comments in your code:

```typescript
/**
 * @openapi
 * /api/resource:
 *   get:
 *     summary: Get all resources
 *     responses:
 *       200:
 *         description: List of resources
 */
```

## Code Quality

### Formatting

The project uses **Biome** for code formatting:

```bash
# Format code
pnpm format

# Check formatting
pnpm format:check
```

### Linting

```bash
# Run linter
pnpm lint

# Fix linting issues
pnpm lint:fix
```

### Testing

```bash
# Run tests
pnpm test

# Run tests for specific app
pnpm test --filter=my-service

# Watch mode
pnpm test:watch
```

## Questions?

- Check existing apps in `apps/` for examples
- Review `packages/database/SEED_TEMPLATE.ts` for seed patterns
- See `packages/database/README.md` for database details
- Open an issue on GitHub for questions or suggestions

Happy coding! 🚀

