# @atlas/create-atlas-app

Scaffolding tool for creating new Atlas services with best practices and boilerplate code.

## Usage

From the root of the Atlas monorepo:

```bash
# Interactive mode
pnpm create-atlas-app

# With app name
pnpm create-atlas-app my-service

# Or using the package directly
pnpm --filter @atlas/create-atlas-app start my-service
```

## What It Creates

The tool generates a complete Atlas service with:

### Core Files
- ✅ **package.json** - Dependencies and scripts
- ✅ **tsconfig.json** - TypeScript configuration
- ✅ **Dockerfile** - Multi-stage Docker build
- ✅ **docker-compose.yml** - Local development setup
- ✅ **README.md** - Comprehensive documentation
- ✅ **.env.example** - Environment variable template

### Source Code
- ✅ **src/index.ts** - Entry point
- ✅ **src/app.ts** - App configuration
- ✅ **src/env.ts** - Environment validation with Zod
- ✅ **src/generate-openapi.ts** - OpenAPI spec generator
- ✅ **src/lib/** - Shared utilities (create-app, types, constants)
- ✅ **src/middlewares/** - Middleware (Pino logger)
- ✅ **src/routes/** - API routes (health check, example routes)

### Database (Optional)
- ✅ **drizzle.config.ts** - Drizzle ORM configuration
- ✅ **src/db/index.ts** - Database connection
- ✅ **src/db/schema.ts** - Database schema with Drizzle
- ✅ **src/db/migrate.ts** - Migration runner
- ✅ **src/db/seed.ts** - Database seeder
- ✅ **src/db/migrations/** - Migration files directory

### Testing
- ✅ **vitest.config.ts** - Vitest configuration
- ✅ **test/** - Test directory with example test

## Interactive Prompts

The tool will ask you:

1. **App name** - Kebab-case name (e.g., `my-service`)
2. **Description** - Brief description of the service
3. **Port** - Default port (e.g., `3000`)
4. **Include database?** - Whether to include PostgreSQL setup
5. **Database name** - Name of the database (if database is included)

## Example

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

Next steps:

  1. Install dependencies:
     pnpm install

  2. Start development server:
     pnpm --filter @atlas/rides-service dev

  3. Run database migrations:
     pnpm --filter @atlas/rides-service db:migrate

  4. Open in browser:
     http://localhost:3001

📚 Documentation:
   - App README: apps/rides-service/README.md
   - Inter-service communication: docs/INTER_SERVICE_COMMUNICATION.md
```

## Generated Structure

```
apps/your-service/
├── src/
│   ├── app.ts                 # App configuration
│   ├── index.ts               # Entry point
│   ├── env.ts                 # Environment variables
│   ├── generate-openapi.ts    # OpenAPI generator
│   ├── db/                    # Database (if included)
│   │   ├── index.ts
│   │   ├── schema.ts
│   │   ├── migrate.ts
│   │   ├── seed.ts
│   │   └── migrations/
│   ├── lib/
│   │   ├── create-app.ts
│   │   ├── types.ts
│   │   └── constants.ts
│   ├── middlewares/
│   │   └── pino-logger.ts
│   └── routes/
│       ├── health.ts
│       └── example/
│           ├── example.routes.ts
│           ├── example.handlers.ts
│           └── example.index.ts
├── test/
│   └── your-service.spec.ts
├── Dockerfile
├── docker-compose.yml
├── drizzle.config.ts          # If database included
├── package.json
├── tsconfig.json
├── tsconfig.test.json
├── vitest.config.ts
├── .env.example
└── README.md
```

## Features

### 🚀 Production-Ready
- Multi-stage Dockerfile for optimized builds
- Health check endpoint
- Structured logging with Pino
- Environment validation with Zod
- TypeScript strict mode

### 📦 Monorepo Integration
- Follows Atlas monorepo conventions
- Uses shared TypeScript config
- Integrates with Turbo build system
- Compatible with CI/CD pipeline

### 🗄️ Database Support
- PostgreSQL with Drizzle ORM
- Type-safe database queries
- Migration system
- Database seeding
- Docker Compose with PostgreSQL

### 📚 Documentation
- Comprehensive README
- OpenAPI specification
- Example routes and handlers
- Environment variable documentation

### 🧪 Testing
- Vitest configuration
- Example tests
- Test scripts in package.json

## Development

To work on the create-atlas-app tool itself:

```bash
# Build the tool
pnpm --filter @atlas/create-atlas-app build

# Watch mode
pnpm --filter @atlas/create-atlas-app dev

# Test it
pnpm --filter @atlas/create-atlas-app start test-service
```

## Customization

After generating a service, you can customize:

1. **Routes** - Add new routes in `src/routes/`
2. **Database Schema** - Modify `src/db/schema.ts`
3. **Environment Variables** - Update `src/env.ts`
4. **Middleware** - Add middleware in `src/middlewares/`
5. **Docker** - Customize `Dockerfile` and `docker-compose.yml`

## Best Practices

The generated service follows Atlas best practices:

- ✅ Hono with Zod OpenAPI for type-safe routes
- ✅ Drizzle ORM for type-safe database queries
- ✅ Pino for structured logging
- ✅ Environment validation with Zod
- ✅ Health check endpoint
- ✅ OpenAPI documentation
- ✅ Docker multi-stage builds
- ✅ Vitest for testing
- ✅ TypeScript strict mode

## Next Steps After Creating a Service

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Start development:**
   ```bash
   pnpm --filter @atlas/your-service dev
   ```

3. **Run migrations (if database):**
   ```bash
   pnpm --filter @atlas/your-service db:migrate
   ```

4. **Add to CI/CD:**
   - The service is automatically detected by the CI/CD pipeline
   - Docker images will be built on push to main
   - No additional configuration needed

5. **Add to API Gateway:**
   - Configure Kong routes
   - Update deployment configuration

## Troubleshooting

### "App already exists"
The tool checks if an app with the same name already exists. Choose a different name or remove the existing app.

### "Invalid app name"
App names must:
- Be lowercase
- Use hyphens for spaces
- Contain only letters, numbers, and hyphens
- Not start or end with a hyphen

### Build errors after generation
Make sure to run `pnpm install` from the monorepo root to install all dependencies.

## Contributing

To add new features to the scaffolding tool:

1. Edit files in `src/generators/`
2. Update templates as needed
3. Test by generating a new service
4. Update this README

## License

MIT

