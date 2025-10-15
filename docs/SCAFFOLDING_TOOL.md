# Atlas Scaffolding Tool

The `@atlas/create-atlas-app` package is a scaffolding tool that generates new Atlas services with all the necessary boilerplate, configuration, and best practices built-in.

## Quick Start

```bash
# Interactive mode
pnpm create-atlas-app

# With app name
pnpm create-atlas-app my-service
```

## What It Does

The scaffolding tool:

1. ✅ Prompts for service configuration (name, description, port, database)
2. ✅ Generates complete service structure with all files
3. ✅ Creates Dockerfile and docker-compose.yml
4. ✅ Sets up TypeScript configuration
5. ✅ Adds example routes and tests
6. ✅ Configures database (optional)
7. ✅ Generates comprehensive README
8. ✅ Follows Atlas best practices

## Generated Files

### Core Configuration
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `tsconfig.test.json` - Test TypeScript configuration
- `vitest.config.ts` - Vitest test configuration
- `.env.example` - Environment variable template
- `README.md` - Service documentation

### Docker
- `Dockerfile` - Multi-stage Docker build
- `docker-compose.yml` - Local development setup with PostgreSQL (if database included)

### Source Code
- `src/index.ts` - Server entry point
- `src/app.ts` - App configuration and route registration
- `src/env.ts` - Environment variable validation with Zod
- `src/generate-openapi.ts` - OpenAPI specification generator

### Library Code
- `src/lib/create-app.ts` - App factory with middleware setup
- `src/lib/types.ts` - TypeScript type definitions
- `src/lib/constants.ts` - Constants and error messages

### Middleware
- `src/middlewares/pino-logger.ts` - Structured logging with Pino

### Routes
- `src/routes/health.ts` - Health check endpoint
- `src/routes/example/example.routes.ts` - Example route definitions
- `src/routes/example/example.handlers.ts` - Example route handlers
- `src/routes/example/example.index.ts` - Example route registration

### Database (Optional)
- `drizzle.config.ts` - Drizzle ORM configuration
- `src/db/index.ts` - Database connection
- `src/db/schema.ts` - Database schema with example table
- `src/db/migrate.ts` - Migration runner
- `src/db/seed.ts` - Database seeder
- `src/db/migrations/` - Migration files directory

### Tests
- `test/{service-name}.spec.ts` - Example test file

## Usage Examples

### Example 1: Simple API Service (No Database)

```bash
$ pnpm create-atlas-app

🚀 Create Atlas App

? What is the name of your app? › notifications-service
? App description: › API service for sending notifications
? Default port: › 3003
? Include PostgreSQL database setup? › No

📦 Creating app: notifications-service

✓ Files generated
✓ App created successfully!
```

### Example 2: Service with Database

```bash
$ pnpm create-atlas-app

🚀 Create Atlas App

? What is the name of your app? › rides-service
? App description: › API service for managing bicycle rides
? Default port: › 3001
? Include PostgreSQL database setup? › Yes
? Database name: › rides_db

📦 Creating app: rides-service

✓ Files generated
✓ App created successfully!
```

### Example 3: Using Command Line Argument

```bash
$ pnpm create-atlas-app analytics-service

🚀 Create Atlas App

? App description: › API service for analytics and reporting
? Default port: › 3004
? Include PostgreSQL database setup? › Yes
? Database name: › analytics_db

📦 Creating app: analytics-service

✓ Files generated
✓ App created successfully!
```

## After Generation

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start Development

```bash
# Start the service
pnpm --filter @atlas/your-service dev

# Or start all services
pnpm dev
```

### 3. Set Up Database (If Included)

```bash
# Generate initial migration
pnpm --filter @atlas/your-service db:generate

# Run migrations
pnpm --filter @atlas/your-service db:migrate

# (Optional) Seed the database
pnpm --filter @atlas/your-service db:seed
```

### 4. Run Tests

```bash
pnpm --filter @atlas/your-service test
```

### 5. Generate OpenAPI Spec

```bash
pnpm --filter @atlas/your-service generate-openapi
```

## Available Scripts

Each generated service includes these scripts:

```bash
# Development
pnpm dev              # Start dev server with hot reload
pnpm build            # Build for production
pnpm start            # Start production server

# Database (if included)
pnpm db:generate      # Generate migrations from schema changes
pnpm db:migrate       # Run migrations
pnpm db:studio        # Open Drizzle Studio
pnpm db:seed          # Seed database with sample data

# Testing & Quality
pnpm test             # Run tests
pnpm test:watch       # Run tests in watch mode
pnpm check-types      # Type check without building
pnpm lint             # Lint code
pnpm format           # Format code

# OpenAPI
pnpm generate-openapi # Generate OpenAPI specification
```

## Customization

After generating a service, you can customize:

### Add New Routes

1. Create a new directory in `src/routes/`
2. Add route definitions, handlers, and index file
3. Register in `src/app.ts`

See [docs/CREATE_NEW_SERVICE.md](./CREATE_NEW_SERVICE.md) for detailed examples.

### Modify Database Schema

1. Edit `src/db/schema.ts`
2. Generate migration: `pnpm db:generate`
3. Run migration: `pnpm db:migrate`

### Add Environment Variables

1. Update `src/env.ts` with new Zod schema
2. Update `.env.example`
3. Use in code: `import env from "./env.js"`

### Add Middleware

1. Create file in `src/middlewares/`
2. Register in `src/lib/create-app.ts`

## Architecture

The generated service follows these patterns:

### 1. App Factory Pattern

```typescript
// src/lib/create-app.ts
export default function createApp() {
  const app = new OpenAPIHono<AppBindings>({
    strict: false,
    defaultHook,
  });
  
  app.use(cors());
  app.use(serveEmojiFavicon("🚀"));
  app.use(createPinoLogger());
  app.notFound(notFound);
  app.onError(onError);
  
  return app;
}
```

### 2. Route-Handler Separation

```typescript
// routes/example/example.routes.ts - Route definitions
export const list = createRoute({
  path: "/examples",
  method: "get",
  responses: { ... },
});

// routes/example/example.handlers.ts - Business logic
export const list: AppRouteHandler<routes.ListRoute> = async (c) => {
  return c.json([...]);
};

// routes/example/example.index.ts - Registration
const router = createRouter()
  .openapi(routes.list, handlers.list);
```

### 3. Environment Validation

```typescript
// src/env.ts
const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(3000),
  // ...
});

export default EnvSchema.parse(process.env);
```

### 4. Type-Safe Database

```typescript
// src/db/schema.ts
export const examples = pgTable("examples", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

export type Example = typeof examples.$inferSelect;
export type InsertExample = typeof examples.$inferInsert;
```

## Best Practices Included

The generated service includes:

1. ✅ **Type Safety** - TypeScript strict mode, Zod validation
2. ✅ **OpenAPI Documentation** - Auto-generated from route definitions
3. ✅ **Structured Logging** - Pino logger with context
4. ✅ **Environment Validation** - Zod schemas for env vars
5. ✅ **Health Checks** - Health endpoint with database check
6. ✅ **Error Handling** - Centralized error handling
7. ✅ **Testing** - Vitest setup with example tests
8. ✅ **Docker** - Multi-stage builds for optimization
9. ✅ **Database Migrations** - Drizzle Kit for schema management
10. ✅ **Code Quality** - Biome for linting and formatting

## Integration with Monorepo

The generated service is automatically integrated with:

- ✅ **Turborepo** - Build caching and task orchestration
- ✅ **pnpm Workspaces** - Dependency management
- ✅ **CI/CD** - GitHub Actions with `--affected` flag
- ✅ **Docker** - Multi-stage builds using Turbo prune
- ✅ **Biome** - Shared linting and formatting config

No additional configuration needed!

## Troubleshooting

### "App already exists"

The tool checks if an app with the same name already exists. Choose a different name or remove the existing app.

### "Invalid app name"

App names must:
- Be lowercase
- Use hyphens for spaces (kebab-case)
- Contain only letters, numbers, and hyphens
- Not start or end with a hyphen

Examples:
- ✅ `rides-service`
- ✅ `user-auth`
- ✅ `analytics-v2`
- ❌ `RidesService` (uppercase)
- ❌ `rides_service` (underscore)
- ❌ `-rides-service` (starts with hyphen)

### Build errors after generation

Make sure to run `pnpm install` from the monorepo root to install all dependencies.

### Port already in use

Change the port in the service's `.env` file or when starting:

```bash
PORT=3005 pnpm --filter @atlas/your-service dev
```

## Advanced Usage

### Modifying the Scaffolding Tool

To customize the generated files:

1. Edit files in `packages/create-atlas-app/src/generators/`
2. Update templates as needed
3. Rebuild: `pnpm --filter @atlas/create-atlas-app build`
4. Test by generating a new service

### Adding New Generators

Create a new generator file:

```typescript
// packages/create-atlas-app/src/generators/my-generator.ts
import type { AppConfig } from "../create-app.js";

export function generateMyFile(config: AppConfig): string {
  return `// Generated file for ${config.displayName}`;
}
```

Use in `generators/index.ts`:

```typescript
import { generateMyFile } from "./my-generator.js";

export async function generateFiles(appPath: string, config: AppConfig) {
  // ...
  await fs.writeFile(
    path.join(appPath, "my-file.ts"),
    generateMyFile(config)
  );
}
```

## Resources

- [Creating a New Service](./CREATE_NEW_SERVICE.md) - Detailed guide
- [Documentation Summary](./SUMMARY.md) - Complete documentation index
- [Main README](../README.md) - Project overview

