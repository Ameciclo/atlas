# TrafficDeaths API

API service for managing traffic deaths data from DATASUS

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
pnpm --filter @atlas/traffic-deaths dev

# In another terminal, run migrations
pnpm --filter @atlas/traffic-deaths db:migrate

```

The application will be available at http://localhost:3003

## Environment Variables

Create a `.env` file in the app directory (see `.env.example`):

```bash
NODE_ENV=development
LOG_LEVEL=info
PORT=3003

# Database (uses shared 'atlas_dev' database in development)
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
pnpm --filter @atlas/traffic-deaths dev

# Run tests
pnpm --filter @atlas/traffic-deaths test

# Run tests in watch mode
pnpm --filter @atlas/traffic-deaths test:watch

# Type checking
pnpm --filter @atlas/traffic-deaths check-types

# Linting
pnpm --filter @atlas/traffic-deaths lint

# Format code
pnpm --filter @atlas/traffic-deaths format
```

## Building

```bash
# Build the application
pnpm --filter @atlas/traffic-deaths build

# Start production server
pnpm --filter @atlas/traffic-deaths start
```

## API Documentation

The API documentation is automatically generated from the OpenAPI specification.

```bash
# Generate OpenAPI spec
pnpm --filter @atlas/traffic-deaths generate-openapi

# View in the docs app
pnpm --filter @atlas/docs dev
# Then open http://localhost:3001
```

## Docker Deployment

The TrafficDeaths API can be deployed as a Docker container. The container image is automatically built and pushed to GitHub Container Registry (ghcr.io) when changes are merged to the main branch.

### Running with Docker

```bash
# Pull the latest image
docker pull ghcr.io/ameciclo/atlas/traffic-deaths:latest

# Run the container with PostgreSQL
docker compose up -d
```

The API will be available at http://localhost:3003

### Building Locally

```bash
# From the traffic-deaths app directory
docker compose up -d

# Or from the root of the monorepo
docker build -t atlas-traffic-deaths -f apps/traffic-deaths/Dockerfile .
docker run -p 3003:3003 --env-file .env atlas-traffic-deaths
```

## API Endpoints

### Health Check

```
GET /health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2023-07-01T12:34:56.789Z",
  "service": "traffic-deaths",
  "database": "connected"
}
```

### Summary Statistics

Get total deaths summary for all years or a specific year.

```
GET /v1/summary?year={year}
```

Query Parameters:
- `year` (optional): Filter by year (2015-2030)

Response:
```json
{
  "total_deaths": 320320,
  "year": null,
  "message": "Total traffic deaths (all years)"
}
```

### Cyclist Deaths

Get cyclist deaths (CID-10 codes V10-V19) with optional filters.

```
GET /v1/deaths/cyclists?year={year}&city_code={code}
```

Query Parameters:
- `year` (optional): Filter by year (2015-2030)
- `city_code` (optional): Filter by city code (IBGE code)

Response:
```json
{
  "total_cyclist_deaths": 12189,
  "year": null,
  "city_code": null,
  "percentage_of_total": 3.81,
  "message": "Cyclist deaths (all years)"
}
```

### Deaths by City

Get deaths grouped by city (occurrence or residence).

```
GET /v1/deaths/by-city?year={year}&location_type={type}
```

Query Parameters:
- `year` (optional): Filter by year (2015-2030)
- `location_type` (optional): `occurrence` (default) or `residence`

Response:
```json
{
  "location_type": "occurrence",
  "year": 2023,
  "cities": [
    {
      "city_code": 2611606,
      "city_name": "Recife",
      "total_deaths": 518
    }
  ],
  "total": 518
}
```

### Deaths by Transport Mode

Get deaths grouped by transport mode (based on CID-10 codes).

```
GET /v1/deaths/by-transport-mode?year={year}&city_code={code}&location_type={type}
```

Query Parameters:
- `year` (optional): Filter by year (2015-2030)
- `city_code` (optional): Filter by city code (IBGE code)
- `location_type` (optional): `occurrence` (default) or `residence`

Response:
```json
{
  "year": 2023,
  "city_code": null,
  "location_type": "occurrence",
  "transport_modes": [
    {
      "mode": "Motociclista",
      "cid10_codes": "V20-V29",
      "total_deaths": 15234,
      "percentage": 47.56
    },
    {
      "mode": "Pedestre",
      "cid10_codes": "V01-V09",
      "total_deaths": 12456,
      "percentage": 38.89
    }
  ],
  "total": 32034
}
```

### Time Series

Get deaths over time (year by year) with optional filters.

```
GET /v1/deaths/time-series?start_year={start}&end_year={end}&city_code={code}&transport_mode={mode}&location_type={type}
```

Query Parameters:
- `start_year` (optional): Start year (default: 2015)
- `end_year` (optional): End year (default: current year)
- `city_code` (optional): Filter by city code (IBGE code)
- `transport_mode` (optional): `pedestrian`, `cyclist`, `motorcyclist`, `tricycle`, `car`, `pickup`, `heavy_vehicle`, `bus`, `other`, `unspecified`
- `location_type` (optional): `occurrence` (default) or `residence`

Response:
```json
{
  "start_year": 2021,
  "end_year": 2023,
  "city_code": null,
  "transport_mode": null,
  "location_type": "occurrence",
  "data": [
    { "year": 2021, "total_deaths": 497 },
    { "year": 2022, "total_deaths": 497 },
    { "year": 2023, "total_deaths": 676 }
  ],
  "total": 1670,
  "average_per_year": 556.67
}
```

### Statistics Summary

Get comprehensive statistics including growth rates and most violent year.

```
GET /v1/stats?city_code={code}&location_type={type}
```

Query Parameters:
- `city_code` (optional): Filter by city code (IBGE code)
- `location_type` (optional): `occurrence` (default) or `residence`

Response:
```json
{
  "city_code": null,
  "location_type": "occurrence",
  "latest_year": 2023,
  "latest_year_deaths": 676,
  "previous_year_deaths": 497,
  "growth_percentage": 36.02,
  "most_violent_year": {
    "year": 2015,
    "total_deaths": 748
  },
  "last_5_years": {
    "total_deaths": 2908,
    "average_per_year": 581.6
  },
  "all_time": {
    "total_deaths": 5564,
    "years_covered": 9,
    "average_per_year": 618.22
  }
}
```

## Project Structure

```
apps/traffic-deaths/
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
│       ├── summary/           # Summary statistics
│       ├── cyclists/          # Cyclist deaths
│       ├── by-city/           # Deaths by city
│       ├── by-transport-mode/ # Deaths by transport mode
│       ├── time-series/       # Time series analysis
│       └── stats/             # Comprehensive statistics
├── test/                      # Tests
├── Dockerfile                 # Docker configuration
├── docker-compose.yml         # Docker Compose configuration
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
└── vitest.config.ts           # Vitest configuration
```

**Note:** Database schema is defined in `packages/database/src/schemas/traffic-deaths/schema.ts` and shared across the monorepo.

## Data Source

This API provides access to Brazil's DATASUS (Sistema de Informações sobre Mortalidade) traffic mortality data from 2015-2023, containing 320,320 death records. The data uses CID-10 (International Classification of Diseases, 10th revision) codes to classify deaths by transport mode.

## Contributing

See the main [README](../../README.md) for contribution guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.
