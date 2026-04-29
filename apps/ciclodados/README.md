# Ciclodados API

API service for ciclodados

## Requirements

- Node.js 22.15.0
- pnpm 10.10.0

We recommend using [mise](https://mise.jdx.dev/) for managing tool versions. A `.tool-versions` file is included in the repository root.

## Getting Started

### Development with Docker

The easiest way to get started is using Docker Compose:

```bash
# Start the application
docker compose up -d

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
pnpm --filter @atlas/ciclodados dev

```

The application will be available at http://localhost:3050

## Environment Variables

Create a `.env` file in the app directory (see `.env.example`):

```bash
NODE_ENV=development
LOG_LEVEL=info
PORT=3050
```

## Development

```bash
# Start development server with hot reload
pnpm --filter @atlas/ciclodados dev

# Run tests
pnpm --filter @atlas/ciclodados test

# Run tests in watch mode
pnpm --filter @atlas/ciclodados test:watch

# Type checking
pnpm --filter @atlas/ciclodados check-types

# Linting
pnpm --filter @atlas/ciclodados lint

# Format code
pnpm --filter @atlas/ciclodados format
```

## Building

```bash
# Build the application
pnpm --filter @atlas/ciclodados build

# Start production server
pnpm --filter @atlas/ciclodados start
```

## API Documentation

The API documentation is automatically generated from the OpenAPI specification.

```bash
# Generate OpenAPI spec
pnpm --filter @atlas/ciclodados generate-openapi

# View in the docs app
pnpm --filter @atlas/docs dev
# Then open http://localhost:3001
```

## Docker Deployment

The Ciclodados API can be deployed as a Docker container. The container image is automatically built and pushed to GitHub Container Registry (ghcr.io) when changes are merged to the main branch.

### Running with Docker

```bash
# Pull the latest image
docker pull ghcr.io/ameciclo/atlas/ciclodados:latest

# Run the container
docker compose up -d
```

The API will be available at http://localhost:3050

### Building Locally

```bash
# From the ciclodados app directory
docker compose up -d

# Or from the root of the monorepo
docker build -t atlas-ciclodados -f apps/ciclodados/Dockerfile .
docker run -p 3050:3050 --env-file .env atlas-ciclodados
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
  "service": "ciclodados"
}
```

## Project Structure

```
apps/ciclodados/
├── src/
│   ├── app.ts                 # App configuration
│   ├── index.ts               # Entry point
│   ├── env.ts                 # Environment variables
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

## Contributing

See the main [README](../../README.md) for contribution guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.
