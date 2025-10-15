# Cyclist Profile Service - Architecture Overview

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
        DB[(PostgreSQL)]
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
    Drizzle->>PostgreSQL: SQL Query
    PostgreSQL-->>Drizzle: Result Set
    Drizzle-->>Handler: Typed Data
    Handler-->>Hono: Response Object
    Hono-->>Client: JSON Response
```

## Database Schema

```mermaid
erDiagram
    cyclist_profiles {
        serial id PK
        jsonb data
        jsonb metadata
        timestamp created_at
        timestamp updated_at
    }
```

## Data Structure

```mermaid
graph LR
    subgraph "Cyclist Profile Data"
        DATA[Data Object]
        META[Metadata Object]
    end

    subgraph "Data Fields"
        AGE[age: number]
        JOB[job: string]
        GENDER[gender: string]
        SCHOOL[schooling: string]
        COLLISION[collisions: string]
        RACE[color_race: string]
        USAGE[days_usage: object]
        YEARS[years_using: string]
        WAGE[wage_standard: number]
        MOTIVATION[motivation_*: string]
        NEIGHBORHOOD[neighborhood_*: string]
        TRANSPORT[transport_combination: object]
    end

    subgraph "Metadata Fields"
        AREA[area: string]
        CITY[city: string]
        DATE[date: ISO string]
        HOUR[hour: ISO string]
        WEEKDAY[weekday: string]
        LOCATION[location: GeoJSON Point]
        BIKE_TYPE[bike_type: string]
        SHEET[sheet_index: number]
        RESEARCHER[researcher_code: number]
    end

    DATA --> AGE
    DATA --> JOB
    DATA --> GENDER
    DATA --> SCHOOL
    DATA --> COLLISION
    DATA --> RACE
    DATA --> USAGE
    DATA --> YEARS
    DATA --> WAGE
    DATA --> MOTIVATION
    DATA --> NEIGHBORHOOD
    DATA --> TRANSPORT

    META --> AREA
    META --> CITY
    META --> DATE
    META --> HOUR
    META --> WEEKDAY
    META --> LOCATION
    META --> BIKE_TYPE
    META --> SHEET
    META --> RESEARCHER
```

## API Endpoints

```mermaid
graph TD
    subgraph "API Routes"
        ROOT["/v1/cyclist-profiles"]
        LIST[GET /cyclist-profiles]
        DETAIL[GET /cyclist-profiles/:id]
    end

    subgraph "Response Types"
        ARRAY[Array of Profiles]
        SINGLE[Single Profile]
        ERROR[Error Response]
    end

    LIST --> ARRAY
    LIST --> ERROR
    DETAIL --> SINGLE
    DETAIL --> ERROR
```

## Middleware Stack

```mermaid
graph TD
    REQUEST[Incoming Request]
    CORS[CORS Middleware]
    FAVICON[Emoji Favicon]
    LOGGER[Pino Logger]
    ROUTES[Route Handler]
    VALIDATION[Zod Validation]
    HANDLER[Business Logic]
    RESPONSE[Response]

    REQUEST --> CORS
    CORS --> FAVICON
    FAVICON --> LOGGER
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
  root((Cyclist Profile))
    Framework
      Hono
      Zod OpenAPI
      TypeScript
    Database
      PostgreSQL
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

## File Structure

```mermaid
graph TD
    subgraph "Source Structure"
        SRC[src/]
        DB[db/]
        LIB[lib/]
        MIDDLEWARE[middlewares/]
        ROUTES[routes/]
    end

    subgraph "Database Files"
        SCHEMA[schema.ts]
        MIGRATE[migrate.ts]
        SEED_FILE[seed.ts]
        DATA[cyclist_profiles.json]
    end

    subgraph "Library Files"
        TYPES[types.ts]
        CONSTANTS[constants.ts]
        CREATE_APP[create-app.ts]
    end

    subgraph "Route Files"
        CYCLIST_ROUTES[cyclist-profiles/]
        HANDLERS_FILE[handlers.ts]
        ROUTES_FILE[routes.ts]
        INDEX_FILE[index.ts]
    end

    SRC --> DB
    SRC --> LIB
    SRC --> MIDDLEWARE
    SRC --> ROUTES

    DB --> SCHEMA
    DB --> MIGRATE
    DB --> SEED_FILE
    DB --> DATA

    LIB --> TYPES
    LIB --> CONSTANTS
    LIB --> CREATE_APP

    ROUTES --> CYCLIST_ROUTES
    CYCLIST_ROUTES --> HANDLERS_FILE
    CYCLIST_ROUTES --> ROUTES_FILE
    CYCLIST_ROUTES --> INDEX_FILE
```

## Key Features

- **Type Safety**: Full TypeScript support with Zod validation
- **OpenAPI**: Automatic API documentation generation
- **Database**: PostgreSQL with Drizzle ORM for type-safe queries
- **Logging**: Structured logging with Pino
- **Testing**: Vitest for unit and integration tests
- **Development**: Hot reload with tsx watch
- **Code Quality**: Biome for linting and formatting
- **Containerization**: Docker support for deployment

## Data Model Insights

The cyclist profile service manages comprehensive cyclist survey data with:

- **Personal Information**: Age, gender, race, education, occupation
- **Cycling Behavior**: Usage patterns, experience, motivations
- **Geographic Data**: Neighborhoods, routes, locations with GeoJSON coordinates
- **Survey Metadata**: Collection context, researcher info, temporal data
- **Infrastructure Needs**: Identified gaps and improvement suggestions

This architecture supports efficient querying and analysis of cyclist demographics and behavior patterns for urban planning and infrastructure development.