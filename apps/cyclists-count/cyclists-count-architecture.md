# Cyclists Count Service - Architecture Overview

## System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        API[REST API Client]
        DOCS[API Documentation]
    end

    subgraph "Application Layer"
        APP[Hono App]
        ROUTES[Route Handlers]
        MIDDLEWARE[Middlewares]
    end

    subgraph "Business Layer"
        HANDLERS[Business Handlers]
        VALIDATION[Zod Validation]
    end

    subgraph "Data Layer"
        DB[(PostgreSQL + PostGIS)]
        SCHEMA[Drizzle Schema]
        SEED[Seed Data]
    end

    API --> APP
    DOCS --> APP
    APP --> ROUTES
    APP --> MIDDLEWARE
    ROUTES --> HANDLERS
    HANDLERS --> VALIDATION
    HANDLERS --> SCHEMA
    SCHEMA --> DB
    SEED --> DB
```

## Data Flow

```mermaid
sequenceDiagram
    participant Client
    participant Hono
    participant Handler
    participant Drizzle
    participant PostgreSQL

    Client->>Hono: HTTP Request
    Hono->>Handler: Route to Handler
    Handler->>Drizzle: Query Database
    Drizzle->>PostgreSQL: SQL Query + PostGIS
    PostgreSQL-->>Drizzle: Result Set + Geometry
    Drizzle-->>Handler: Typed Data
    Handler-->>Hono: Response Object
    Hono-->>Client: JSON Response
```

## Database Schema

```mermaid
erDiagram
    cyclists_counts {
        serial id PK
        jsonb data
        jsonb metadata
        geometry coordinates
        timestamp created_at
        timestamp updated_at
    }
```

## API Endpoints

```mermaid
graph TD
    subgraph "API Routes"
        ROOT["/v1/cyclists-counts"]
        LIST[GET /cyclists-counts]
        DETAIL[GET /cyclists-counts/:id]
        HEALTH[GET /health]
    end

    subgraph "Response Types"
        ARRAY[Array of Counts]
        SINGLE[Single Count]
        STATUS[Health Status]
        ERROR[Error Response]
    end

    LIST --> ARRAY
    LIST --> ERROR
    DETAIL --> SINGLE
    DETAIL --> ERROR
    HEALTH --> STATUS
    HEALTH --> ERROR
```

## Data Structure

```mermaid
graph LR
    subgraph "Cyclists Count Data"
        DATA[Data Object]
        META[Metadata Object]
        COORDS[Coordinates]
    end

    subgraph "Data Fields"
        SESSIONS[sessions: Array]
        SUMMARY[summary: Object]
        START[start_time: ISO string]
        END[end_time: ISO string]
        TOTAL[total_count: number]
        DIRECTIONS[directions: Object]
        CHARACTERISTICS[characteristics: Object]
    end

    subgraph "Metadata Fields"
        GARFO_ID[garfo_id: number]
        SLUG[slug: string]
        LOCATION_NAME[location_name: string]
        DATE[date: ISO string]
        CITY[city: Object]
        DIR_LABELS[directions_labels: Object]
    end

    subgraph "Coordinates"
        POINT[PostGIS POINT]
        SRID[SRID 4326]
        LAT[latitude: number]
        LNG[longitude: number]
    end

    DATA --> SESSIONS
    DATA --> SUMMARY
    SESSIONS --> START
    SESSIONS --> END
    SESSIONS --> TOTAL
    SESSIONS --> DIRECTIONS
    SESSIONS --> CHARACTERISTICS

    META --> GARFO_ID
    META --> SLUG
    META --> LOCATION_NAME
    META --> DATE
    META --> CITY
    META --> DIR_LABELS

    COORDS --> POINT
    COORDS --> SRID
    COORDS --> LAT
    COORDS --> LNG
```

## File Structure

```mermaid
graph TD
    subgraph "Source Structure"
        SRC[src/]
        DB[db/]
        LIB[lib/]
        ROUTES[routes/]
    end

    subgraph "Database Files"
        SCHEMA[schema.ts]
        MIGRATE[migrate.ts]
        SEED_FILE[seed.ts]
        DATA[cyclists_counts.json]
    end

    subgraph "Library Files"
        TYPES[types.ts]
        CONSTANTS[constants.ts]
        CREATE_APP[create-app.ts]
    end

    subgraph "Route Files"
        EXAMPLE_ROUTES[example/]
        HEALTH_ROUTES[health.ts]
        HANDLERS_FILE[handlers.ts]
        ROUTES_FILE[routes.ts]
        INDEX_FILE[index.ts]
    end

    SRC --> DB
    SRC --> LIB
    SRC --> ROUTES

    DB --> SCHEMA
    DB --> MIGRATE
    DB --> SEED_FILE
    DB --> DATA

    LIB --> TYPES
    LIB --> CONSTANTS
    LIB --> CREATE_APP

    ROUTES --> EXAMPLE_ROUTES
    ROUTES --> HEALTH_ROUTES
    EXAMPLE_ROUTES --> HANDLERS_FILE
    EXAMPLE_ROUTES --> ROUTES_FILE
    EXAMPLE_ROUTES --> INDEX_FILE
```

## Middleware Stack

```mermaid
graph TD
    REQUEST[Incoming Request]
    CORS[CORS Middleware]
    LOGGER[Pino Logger]
    ROUTES[Route Handler]
    VALIDATION[Zod Validation]
    HANDLER[Business Logic]
    RESPONSE[Response]

    REQUEST --> CORS
    CORS --> LOGGER
    LOGGER --> ROUTES
    ROUTES --> VALIDATION
    VALIDATION --> HANDLER
    HANDLER --> RESPONSE
```

## Development Workflow

```mermaid
graph LR
    subgraph "Development"
        DEV[npm run dev]
        WATCH[tsx watch]
        RELOAD[Auto Reload]
    end

    subgraph "Database"
        MIGRATE[npm run db:migrate]
        SEED[npm run db:seed]
        STUDIO[npm run db:studio]
    end

    subgraph "Quality"
        LINT[npm run lint]
        FORMAT[npm run format]
        TEST[npm run test]
        TYPES[npm run check-types]
    end

    subgraph "Build"
        BUILD[npm run build]
        OPENAPI[npm run generate-openapi]
        START[npm run start]
    end

    DEV --> WATCH
    WATCH --> RELOAD
    MIGRATE --> SEED
    SEED --> STUDIO
    LINT --> FORMAT
    FORMAT --> TEST
    TEST --> TYPES
    BUILD --> OPENAPI
    OPENAPI --> START
```

## Technology Stack

```mermaid
mindmap
  root((Cyclists Count))
    Framework
      Hono
      Zod OpenAPI
      TypeScript
    Database
      PostgreSQL
      PostGIS
      Drizzle ORM
      Drizzle Kit
    Development
      tsx
      Vitest
      Biome
    Middleware
      CORS
      Pino Logger
      Stoker
    Deployment
      Docker
      Node.js
```

## Key Features

- **Type Safety**: Full TypeScript support with Zod validation
- **OpenAPI**: Automatic API documentation generation
- **PostGIS**: Spatial database support for geographic queries
- **Database**: PostgreSQL with Drizzle ORM for type-safe queries
- **Logging**: Structured logging with Pino
- **Testing**: Vitest for unit and integration tests
- **Development**: Hot reload with tsx watch
- **Code Quality**: Biome for linting and formatting
- **Containerization**: Docker support for deployment

## Data Model Insights

The cyclists count service manages comprehensive cycling count data with:

- **Count Sessions**: Time-based counting intervals with directional data
- **Geographic Data**: PostGIS points for precise location mapping
- **Directional Analysis**: North/South/East/West movement patterns
- **Cyclist Characteristics**: Demographics like gender, helmet usage, cargo
- **Temporal Data**: Date/time patterns for traffic analysis
- **Research Metadata**: Survey context, location names, city information

This architecture supports efficient spatial queries and temporal analysis of cycling patterns for urban planning and infrastructure development.

