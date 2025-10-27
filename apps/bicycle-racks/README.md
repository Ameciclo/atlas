# Bicycle Racks API

REST API service for managing and querying bicycle parking facilities data across Brazil, with special focus on Recife city.

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
pnpm --filter @atlas/bicycle-racks dev

# In another terminal, run migrations
pnpm --filter @atlas/bicycle-racks db:migrate

```

The application will be available at http://localhost:3005

## Environment Variables

Create a `.env` file in the app directory (see `.env.example`):

```bash
NODE_ENV=development
LOG_LEVEL=info
PORT=3005

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
pnpm --filter @atlas/bicycle-racks dev

# Run tests
pnpm --filter @atlas/bicycle-racks test

# Run tests in watch mode
pnpm --filter @atlas/bicycle-racks test:watch

# Type checking
pnpm --filter @atlas/bicycle-racks check-types

# Linting
pnpm --filter @atlas/bicycle-racks lint

# Format code
pnpm --filter @atlas/bicycle-racks format
```

## Building

```bash
# Build the application
pnpm --filter @atlas/bicycle-racks build

# Start production server
pnpm --filter @atlas/bicycle-racks start
```

## API Endpoints

The API provides the following endpoints with optional city filtering:

### Core Endpoints

- `GET /v1/bicycle-racks` - List all bicycle racks
- `GET /v1/bicycle-racks/{id}` - Get specific bicycle rack by ID
- `GET /v1/bicycle-racks/stats` - Get statistics about bicycle racks
- `GET /v1/bicycle-racks/geojson` - Get bicycle racks as GeoJSON
- `GET /v1/bicycle-racks/nearby` - Find nearby bicycle racks

### City Filtering

All endpoints support optional `city` parameter for filtering:

```bash
# Get all bicycle racks in Brazil (5,598 total)
curl "http://localhost:3005/v1/bicycle-racks"

# Get only Recife bicycle racks (578 total)
curl "http://localhost:3005/v1/bicycle-racks?city=Recife"

# Get Recife statistics
curl "http://localhost:3005/v1/bicycle-racks/stats?city=Recife"

# Get Recife data as GeoJSON
curl "http://localhost:3005/v1/bicycle-racks/geojson?city=Recife"

# Find nearby racks in Recife (Marco Zero area)
curl "http://localhost:3005/v1/bicycle-racks/nearby?lat=-8.0631&lng=-34.8713&radius=1000&city=Recife"
```

### Query Parameters

- `city` (optional) - Filter by city name (e.g., "Recife")
- `covered` (optional) - Filter by covered status ("yes", "no")
- `access` (optional) - Filter by access type ("yes", "private", "permissive", "customers")
- `capacity_min` (optional) - Minimum capacity filter
- `capacity_max` (optional) - Maximum capacity filter
- `operator` (optional) - Filter by operator name

## API Documentation

The API documentation is automatically generated from the OpenAPI specification.

```bash
# Generate OpenAPI spec
pnpm --filter @atlas/bicycle-racks generate-openapi

# View in the docs app
pnpm --filter @atlas/docs dev
# Then open http://localhost:3001
```

## Docker Deployment

The BicycleRacks API can be deployed as a Docker container. The container image is automatically built and pushed to GitHub Container Registry (ghcr.io) when changes are merged to the main branch.

### Running with Docker

```bash
# Pull the latest image
docker pull ghcr.io/ameciclo/atlas/bicycle-racks:latest

# Run the container with PostgreSQL
docker compose up -d
```

The API will be available at http://localhost:3005

### Building Locally

```bash
# From the bicycle-racks app directory
docker compose up -d

# Or from the root of the monorepo
docker build -t atlas-bicycle-racks -f apps/bicycle-racks/Dockerfile .
docker run -p 3005:3005 --env-file .env atlas-bicycle-racks
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
  "service": "bicycle-racks",
  "database": "connected"
}
```

## Project Structure

```
apps/bicycle-racks/
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

**Note:** Database schema is defined in `packages/database/src/schemas/bicycle-racks/schema.ts` and shared across the monorepo.

## Data Sources

The API serves bicycle parking facilities data from:

- **Brazil-wide data**: OpenStreetMap bicycle parking facilities across Brazil (5,598 total)
- **Recife-specific data**: Enhanced dataset with city mapping for precise filtering (578 in Recife)
- **Real-time filtering**: Efficient JOIN-based queries for city-specific data retrieval

### Database Tables

- `bicycle_racks` - Main table with bicycle parking facilities data
- `bicycle_rack_cities` - City mapping table for efficient filtering by city name

## Contributing

See the main [README](../../README.md) for contribution guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.
