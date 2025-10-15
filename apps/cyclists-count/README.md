# CyclistsCount API

API service for cyclists count data management with PostGIS spatial capabilities.

## Data Format

The service expects cyclist count data in the following JSON format:

```json
[
  {
    "id": 38,
    "metadata": {
      "name": "Av. Recife x R. São Nicolau",
      "date": "2019-12-05",
      "city": {
        "id": 2611606,
        "name": "Recife",
        "state": "PE",
        "full_state": "Pernambuco",
        "rmr": true
      },
      "directions": {
        "north": "Estância",
        "east": "Ibura",
        "south": "Boa Viagem",
        "west": "IPSEP"
      }
    },
    "data": {
      "sessions": [
        {
          "session": "09-10",
          "start_time": "2019-12-05T09:00:00.000Z",
          "end_time": "2019-12-05T10:00:00.000Z",
          "total_cyclists": 244,
          "quantitative": {
            "north_west": 7,
            "north_south": 17,
            "north_east": 2,
            "east_north": 13,
            "east_west": 82,
            "east_south": 9,
            "south_east": 6,
            "south_north": 72,
            "south_west": 7,
            "west_south": 2,
            "west_east": 22,
            "west_north": 5
          },
          "characteristics": {
            "cargo": 36,
            "helmet": 15,
            "juveniles": 0,
            "motor": 0,
            "other_active_modes": 0,
            "other_behaviors": 4,
            "others": 0,
            "rain": 0,
            "ride": 3,
            "service": 1,
            "shared_bike": 0,
            "sidewalk": 20,
            "women": 8,
            "wrong_way": 15
          }
        }
      ],
      "summary": {
        "max_hour": 244,
        "total_cyclists": 244,
        "total_cargo": 36,
        "total_helmet": 15,
        "total_juveniles": 0,
        "total_motor": 0,
        "total_ride": 3,
        "total_service": 1,
        "total_shared_bike": 0,
        "total_sidewalk": 20,
        "total_women": 8,
        "total_wrong_way": 15
      }
    },
    "coordinates": {
      "x": -34.92721,
      "y": -8.10695
    }
  }
]
```

### Data Structure

- **id**: Unique identifier for the count location
- **metadata**: Information about the counting location and context
  - **name**: Location name/description
  - **date**: Date of the count
  - **city**: City information
  - **directions**: Cardinal directions and their destinations
- **data**: Actual counting data
  - **sessions**: Array of counting sessions with hourly format ("HH-HH")
  - **summary**: Aggregated totals for the entire count
- **coordinates**: Geographic coordinates (longitude, latitude) for PostGIS

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
pnpm --filter @atlas/cyclists-count dev

# In another terminal, run migrations
pnpm --filter @atlas/cyclists-count db:migrate

```

The application will be available at http://localhost:3002

## Environment Variables

Create a `.env` file in the app directory (see `.env.example`):

```bash
NODE_ENV=development
LOG_LEVEL=info
PORT=3002

# Database
DATABASE_URL=postgres://postgres:postgres@localhost:5432/cyclists-count_db
# Or use individual settings:
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=cyclists-count_db
DB_SSL=false
```

## PostGIS Integration

This service uses PostGIS for spatial data management. The database schema includes:

- **Geometry column**: `coordinates` with SRID 4326 (WGS84)
- **Spatial index**: GIST index for efficient spatial queries
- **PostGIS functions**: ST_MakePoint, ST_SetSRID, ST_Distance, ST_Within

### Spatial Queries Examples

```typescript
// Find nearest locations
const point = { x: -34.92721, y: -8.10695 };
const sqlPoint = sql`ST_SetSRID(ST_MakePoint(${point.x}, ${point.y}), 4326)`;

const nearest = await db
  .select({
    ...getTableColumns(cyclistsCounts),
    distance: sql`ST_Distance(${cyclistsCounts.coordinates}, ${sqlPoint})`,
  })
  .from(cyclistsCounts)
  .orderBy(sql`${cyclistsCounts.coordinates} <-> ${sqlPoint}`)
  .limit(5);

// Find locations within area
const bounds = { x1: -35, y1: -8.5, x2: -34.5, y2: -8 };

const withinArea = await db
  .select()
  .from(cyclistsCounts)
  .where(
    sql`ST_Within(
      ${cyclistsCounts.coordinates}, 
      ST_MakeEnvelope(${bounds.x1}, ${bounds.y1}, ${bounds.x2}, ${bounds.y2}, 4326)
    )`
  );
```

## Database Management

```bash
# Generate PostGIS extension migration (first time only)
pnpm --filter @atlas/cyclists-count db:generate --custom
# Add: CREATE EXTENSION IF NOT EXISTS postgis;

# Generate new migrations
pnpm --filter @atlas/cyclists-count db:generate

# Apply migrations
pnpm --filter @atlas/cyclists-count db:migrate

# View database with Drizzle Studio
pnpm --filter @atlas/cyclists-count db:studio

# Seed the database with sample data
pnpm --filter @atlas/cyclists-count db:seed
```

## Development

```bash
# Start development server with hot reload
pnpm --filter @atlas/cyclists-count dev

# Run tests
pnpm --filter @atlas/cyclists-count test

# Run tests in watch mode
pnpm --filter @atlas/cyclists-count test:watch

# Type checking
pnpm --filter @atlas/cyclists-count check-types

# Linting
pnpm --filter @atlas/cyclists-count lint

# Format code
pnpm --filter @atlas/cyclists-count format
```

## Building

```bash
# Build the application
pnpm --filter @atlas/cyclists-count build

# Start production server
pnpm --filter @atlas/cyclists-count start
```

## API Documentation

The API documentation is automatically generated from the OpenAPI specification.

```bash
# Generate OpenAPI spec
pnpm --filter @atlas/cyclists-count generate-openapi

# View in the docs app
pnpm --filter @atlas/docs dev
# Then open http://localhost:3001
```

## Docker Deployment

The CyclistsCount API can be deployed as a Docker container. The container image is automatically built and pushed to GitHub Container Registry (ghcr.io) when changes are merged to the main branch.

### Running with Docker

```bash
# Pull the latest image
docker pull ghcr.io/ameciclo/atlas/cyclists-count:latest

# Run the container with PostgreSQL
docker compose up -d
```

The API will be available at http://localhost:3002

### Building Locally

```bash
# From the cyclists-count app directory
docker compose up -d

# Or from the root of the monorepo
docker build -t atlas-cyclists-count -f apps/cyclists-count/Dockerfile .
docker run -p 3002:3002 --env-file .env atlas-cyclists-count
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
  "service": "cyclists-count",
  "database": "connected"
}
```

## Project Structure

```
apps/cyclists-count/
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
