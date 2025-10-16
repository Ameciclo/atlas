# RecifeBicycleSigns API

API service for recife-bicycle-signs

## Requirements

- Node.js 22.15.0
- pnpm 10.10.0
- PostgreSQL database

We recommend using [mise](https://mise.jdx.dev/) for managing tool versions. A `.tool-versions` file is included in the repository root.

## Getting Started

### Development with Docker

The easiest way to get started is using Docker Compose:

```bash
# Start the application and database
docker compose up -d

# Run database migrations
docker compose exec app pnpm db:migrate

# View logs
docker compose logs -f

# Stop the application
docker compose down
```

### Manual Setup

If you prefer to run the application without Docker:

```bash
# Install dependencies (from monorepo root)
pnpm install

# Start the development server
pnpm --filter @atlas/recife-bicycle-signs dev

# In another terminal, run migrations
pnpm --filter @atlas/recife-bicycle-signs db:migrate

```

The application will be available at http://localhost:3010

## Environment Variables

Create a `.env` file in the app directory (see `.env.example`):

```bash
NODE_ENV=development
LOG_LEVEL=info
PORT=3010

# Database
DATABASE_URL=postgres://postgres:postgres@localhost:5432/recife-bicycle-signs_db
# Or use individual settings:
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=recife-bicycle-signs_db
DB_SSL=false
```

## Database Management

```bash
# Generate new migrations
pnpm --filter @atlas/recife-bicycle-signs db:generate

# Apply migrations
pnpm --filter @atlas/recife-bicycle-signs db:migrate

# View database with Drizzle Studio
pnpm --filter @atlas/recife-bicycle-signs db:studio

# Seed the database with sample data
pnpm --filter @atlas/recife-bicycle-signs db:seed
```

## Development

```bash
# Start development server with hot reload
pnpm --filter @atlas/recife-bicycle-signs dev

# Run tests
pnpm --filter @atlas/recife-bicycle-signs test

# Run tests in watch mode
pnpm --filter @atlas/recife-bicycle-signs test:watch

# Type checking
pnpm --filter @atlas/recife-bicycle-signs check-types

# Linting
pnpm --filter @atlas/recife-bicycle-signs lint

# Format code
pnpm --filter @atlas/recife-bicycle-signs format
```

## Building

```bash
# Build the application
pnpm --filter @atlas/recife-bicycle-signs build

# Start production server
pnpm --filter @atlas/recife-bicycle-signs start
```

## API Documentation

The API documentation is automatically generated from the OpenAPI specification.

```bash
# Generate OpenAPI spec
pnpm --filter @atlas/recife-bicycle-signs generate-openapi

# View in the docs app
pnpm --filter @atlas/docs dev
# Then open http://localhost:3001
```

## Docker Deployment

The RecifeBicycleSigns API can be deployed as a Docker container. The container image is automatically built and pushed to GitHub Container Registry (ghcr.io) when changes are merged to the main branch.

### Running with Docker

```bash
# Pull the latest image
docker pull ghcr.io/ameciclo/atlas/recife-bicycle-signs:latest

# Run the container with PostgreSQL
docker compose up -d
```

The API will be available at http://localhost:3010

### Building Locally

```bash
# From the recife-bicycle-signs app directory
docker compose up -d

# Or from the root of the monorepo
docker build -t atlas-recife-bicycle-signs -f apps/recife-bicycle-signs/Dockerfile .
docker run -p 3010:3010 --env-file .env atlas-recife-bicycle-signs
```

## Health Check

The API includes a health check endpoint:

```
GET /health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2023-07-01T12:34:56.789Z",
  "service": "recife-bicycle-signs",
  "database": "connected"
}
```

## Project Structure

```
apps/recife-bicycle-signs/
├── src/
│   ├── app.ts                 # App configuration
│   ├── index.ts               # Entry point
│   ├── env.ts                 # Environment variables
│   ├── db/                    # Database
│   │   ├── index.ts           # Database connection
│   │   ├── schema.ts          # Database schema
│   │   ├── migrate.ts         # Migration runner
│   │   ├── seed.ts            # Database seeder
│   │   └── migrations/        # Migration files
│   ├── lib/                   # Shared utilities
│   │   ├── create-app.ts      # App factory
│   │   ├── types.ts           # TypeScript types
│   │   └── constants.ts       # Constants
│   ├── middlewares/           # Middleware
│   │   └── pino-logger.ts     # Logger middleware
│   └── routes/                # API routes
│       ├── health.ts          # Health check
│       └── example/           # Example routes
├── test/                      # Tests
├── Dockerfile                 # Docker configuration
├── docker-compose.yml         # Docker Compose configuration
├── drizzle.config.ts          # Drizzle ORM configuration
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
└── vitest.config.ts           # Vitest configuration
```

## Contributing

See the main [README](../../README.md) for contribution guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.
