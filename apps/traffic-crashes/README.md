# TrafficCrashes API

API service for traffic_crashes

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
pnpm --filter @atlas/traffic-crashes dev

# In another terminal, run migrations
pnpm --filter @atlas/traffic-crashes db:migrate

```

The application will be available at http://localhost:3007

## Environment Variables

Create a `.env` file in the app directory (see `.env.example`):

```bash
NODE_ENV=development
LOG_LEVEL=info
PORT=3007

# Database
DATABASE_URL=postgres://postgres:postgres@localhost:5432/atlas_dev
# Or use individual settings:
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=atlas_dev
DB_SSL=false
```

## Database Management

This app uses the shared `@atlas/database` package for database management.

```bash
# Generate new migrations (from database package)
pnpm --filter @atlas/database db:generate

# Apply migrations
pnpm --filter @atlas/database db:migrate

# View database with Drizzle Studio
pnpm --filter @atlas/database db:studio

# Seed the database with sample data (if available)
pnpm --filter @atlas/database db:seed
```

## Development

```bash
# Start development server with hot reload
pnpm --filter @atlas/traffic-crashes dev

# Run tests
pnpm --filter @atlas/traffic-crashes test

# Run tests in watch mode
pnpm --filter @atlas/traffic-crashes test:watch

# Type checking
pnpm --filter @atlas/traffic-crashes check-types

# Linting
pnpm --filter @atlas/traffic-crashes lint

# Format code
pnpm --filter @atlas/traffic-crashes format
```

## Building

```bash
# Build the application
pnpm --filter @atlas/traffic-crashes build

# Start production server
pnpm --filter @atlas/traffic-crashes start
```

## API Documentation

The API documentation is automatically generated from the OpenAPI specification.

```bash
# Generate OpenAPI spec
pnpm --filter @atlas/traffic-crashes generate-openapi

# View in the docs app
pnpm --filter @atlas/docs dev
# Then open http://localhost:3001
```

## Docker Deployment

The TrafficCrashes API can be deployed as a Docker container. The container image is automatically built and pushed to GitHub Container Registry (ghcr.io) when changes are merged to the main branch.

### Running with Docker

```bash
# Pull the latest image
docker pull ghcr.io/ameciclo/atlas/traffic-crashes:latest

# Run the container with PostgreSQL
docker compose up -d
```

The API will be available at http://localhost:3007

### Building Locally

```bash
# From the traffic-crashes app directory
docker compose up -d

# Or from the root of the monorepo
docker build -t atlas-traffic-crashes -f apps/traffic-crashes/Dockerfile .
docker run -p 3007:3007 --env-file .env atlas-traffic-crashes
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
  "service": "traffic-crashes",
  "database": "connected"
}
```

## Project Structure

```
apps/traffic-crashes/
├── src/
│   ├── app.ts                 # App configuration
│   ├── index.ts               # Entry point
│   ├── env.ts                 # Environment variables
│   ├── db/                    # Database
│   │   ├── index.ts           # Database connection
│   │   └── schema.ts          # Re-exports from @atlas/database
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
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
└── vitest.config.ts           # Vitest configuration
```

**Note:** Database schema is defined in `packages/database/src/schemas/traffic-crashes/schema.ts` and shared across the monorepo.

## Contributing

See the main [README](../../README.md) for contribution guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.
