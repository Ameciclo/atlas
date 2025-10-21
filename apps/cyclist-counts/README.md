# CyclistCounts API

API service for managing cyclist counting data and locations

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
pnpm --filter @atlas/cyclist-counts dev

# In another terminal, run migrations
pnpm --filter @atlas/cyclist-counts db:migrate

```

The application will be available at http://localhost:3002

## Environment Variables

Create a `.env` file in the app directory (see `.env.example`):

```bash
NODE_ENV=development
LOG_LEVEL=info
PORT=3002

# Database
DATABASE_URL=postgres://postgres:postgres@localhost:5432/atlas
# Or use individual settings:
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=atlas
DB_SSL=false
```

## Database Management

```bash
# Generate new migrations
pnpm --filter @atlas/cyclist-counts db:generate

# Apply migrations
pnpm --filter @atlas/cyclist-counts db:migrate

# View database with Drizzle Studio
pnpm --filter @atlas/cyclist-counts db:studio

# Seed the database with sample data
pnpm --filter @atlas/cyclist-counts db:seed
```

## Development

```bash
# Start development server with hot reload
pnpm --filter @atlas/cyclist-counts dev

# Run tests
pnpm --filter @atlas/cyclist-counts test

# Run tests in watch mode
pnpm --filter @atlas/cyclist-counts test:watch

# Type checking
pnpm --filter @atlas/cyclist-counts check-types

# Linting
pnpm --filter @atlas/cyclist-counts lint

# Format code
pnpm --filter @atlas/cyclist-counts format
```

## Building

```bash
# Build the application
pnpm --filter @atlas/cyclist-counts build

# Start production server
pnpm --filter @atlas/cyclist-counts start
```

## API Documentation

The API documentation is automatically generated from the OpenAPI specification.

```bash
# Generate OpenAPI spec
pnpm --filter @atlas/cyclist-counts generate-openapi

# View in the docs app
pnpm --filter @atlas/docs dev
# Then open http://localhost:3001
```

### API Endpoints

#### Locations

**List all counting locations**
```bash
GET /v1/locations
GET /v1/locations?city=Recife
```

Example response:
```json
[
  {
    "id": 1,
    "name": "Av. Rui Barbosa x R. Amélia",
    "city": "Recife",
    "state": "PE",
    "latitude": "-8.04511",
    "longitude": "-34.90207",
    "metadata": {
      "ibge_city_id": 2611606,
      "state_full": "Pernambuco",
      "is_rmr": true,
      "directions": {
        "north": "Parnamirim",
        "east": "Espinheiro",
        "south": "Centro",
        "west": "Torre"
      }
    }
  }
]
```

**Get location by ID**
```bash
GET /v1/locations/{id}
```

#### Events

**List all counting events**
```bash
GET /v1/events
GET /v1/events?location_id=1
GET /v1/events?city=Recife
GET /v1/events?start_date=2023-01-01&end_date=2023-12-31
```

Example response:
```json
[
  {
    "id": 122,
    "location_id": 36,
    "counting_date": "2023-11-09",
    "start_time": "06:00:00",
    "end_time": "20:00:00",
    "total_cyclists": 3961,
    "max_hour_cyclists": 566,
    "weather_conditions": {
      "temperature": 28,
      "condition": "sunny"
    },
    "notes": "Normal counting day"
  }
]
```

**Get event by ID**
```bash
GET /v1/events/{id}
```

**Get events by location**
```bash
GET /v1/locations/{id}/events
```

Example:
```bash
curl http://localhost:3002/v1/locations/36/events
```

#### Sessions

**Get sessions by event**
```bash
GET /v1/events/{id}/sessions
```

Example response:
```json
[
  {
    "id": 1683,
    "event_id": 122,
    "session_label": "06-07",
    "start_time": "2023-11-09T09:00:00.000Z",
    "end_time": "2023-11-09T10:00:00.000Z",
    "total_cyclists": 351,
    "characteristics": {
      "women": 26,
      "helmet": 15,
      "cargo": 90,
      "motor": 1,
      "ride": 18,
      "rain": 0,
      "sidewalk": 31,
      "wrong_way": 94,
      "juveniles": 1,
      "service": 0,
      "shared_bike": 2,
      "other_behaviors": 136,
      "other_active_modes": 0,
      "others": 0
    }
  }
]
```

**Get session by ID**
```bash
GET /v1/sessions/{id}
```

Example:
```bash
curl http://localhost:3002/v1/sessions/1683
```

### Query Parameters

#### Events Filters

- `location_id` (number): Filter events by location ID
- `city` (string): Filter events by city name
- `start_date` (date): Filter events from this date (inclusive, format: YYYY-MM-DD)
- `end_date` (date): Filter events until this date (inclusive, format: YYYY-MM-DD)

#### Locations Filters

- `city` (string): Filter locations by city name

### Example Usage

```bash
# Get all locations in Recife
curl http://localhost:3002/v1/locations?city=Recife

# Get all events in 2023
curl "http://localhost:3002/v1/events?start_date=2023-01-01&end_date=2023-12-31"

# Get events for a specific location
curl http://localhost:3002/v1/locations/36/events

# Get sessions for an event
curl http://localhost:3002/v1/events/122/sessions

# Get a specific session
curl http://localhost:3002/v1/sessions/1683
```

## Docker Deployment

The CyclistCounts API can be deployed as a Docker container. The container image is automatically built and pushed to GitHub Container Registry (ghcr.io) when changes are merged to the main branch.

### Running with Docker

```bash
# Pull the latest image
docker pull ghcr.io/ameciclo/atlas/cyclist-counts:latest

# Run the container with PostgreSQL
docker compose up -d
```

The API will be available at http://localhost:3002

### Building Locally

```bash
# From the cyclist-counts app directory
docker compose up -d

# Or from the root of the monorepo
docker build -t atlas-cyclist-counts -f apps/cyclist-counts/Dockerfile .
docker run -p 3002:3002 --env-file .env atlas-cyclist-counts
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
  "service": "cyclist-counts",
  "database": "connected"
}
```

## Project Structure

```
apps/cyclist-counts/
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
