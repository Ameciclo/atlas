# Atlas Project

[![][GitHubStars]][GitHubRepo]
[![][GitHubLicense]][GitHubLicenseUrl]
[![CI Status](https://github.com/ameciclo/atlas/actions/workflows/ci.yml/badge.svg)](https://github.com/ameciclo/atlas/actions/workflows/ci.yml)
[![Docker Build Status](https://github.com/ameciclo/atlas/actions/workflows/docker.yml/badge.svg)](https://github.com/ameciclo/atlas/actions/workflows/docker.yml)

**A comprehensive monorepo platform for urban mobility data management and analysis, focusing on cyclist safety, traffic patterns, and transportation infrastructure in Brazilian cities**

## Overview

Atlas is a modern, scalable platform built as a monorepo that provides APIs and tools for managing urban mobility data. The platform specializes in cyclist data collection, traffic analysis, emergency response tracking, and infrastructure management, primarily serving Brazilian metropolitan regions.

This monorepo utilizes pnpm workspaces and Turborepo for efficient development, building, and deployment of microservices. It provides a standardized and maintainable environment for all projects within the Atlas ecosystem.

## Technologies

* **Monorepo Management:** pnpm workspaces (https://pnpm.io/)
* **Build System & Caching:** Turborepo (https://turbo.build/)
* **Code Quality:** Biome for formatting and linting (https://biomejs.dev/)
* **Languages:** TypeScript with ES Modules
* **API Framework:** Hono with Zod OpenAPI for type-safe APIs
* **Database:** PostgreSQL 16 with PostGIS extension
* **ORM:** Drizzle ORM for type-safe database queries
* **Documentation:** Scalar API Reference with auto-generated OpenAPI specs
* **Containerization:** Docker with multi-stage builds
* **CI/CD:** GitHub Actions with intelligent caching
* **Deployment:** Portainer with webhook-based deployments
* **Testing:** Vitest for unit and integration tests

## Requirements

- Node.js 22.15.0
- pnpm 10.10.0

We recommend using [mise](https://mise.jdx.dev/) for managing tool versions. A `.tool-versions` file is included in the repository.

## Getting Started

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/ameciclo/atlas.git
   cd atlas
   ```

2. **Install Dependencies:**
   ```bash
   pnpm install
   ```

3. **Start the Database:**
   ```bash
   # Start PostgreSQL with PostGIS
   docker-compose up -d

   # Run migrations
   pnpm --filter @atlas/database db:migrate
   ```

4. **Development:**
   ```bash
   # Start all services
   pnpm dev

   # Or start a specific service
   pnpm --filter @atlas/cyclist-profile dev
   pnpm --filter @atlas/bicycle-racks dev
   ```

5. **Building:**
   ```bash
   # Build all applications/packages
   pnpm build

   # Or build a specific application
   pnpm --filter @atlas/cyclist-profile build
   pnpm --filter @atlas/bicycle-racks build
   ```

6. **Testing:**
   ```bash
   # Run all tests
   pnpm test

   # Or test a specific application
   pnpm --filter @atlas/cyclist-profile test
   pnpm --filter @atlas/bicycle-racks test
   ```

7. **Code Quality:**
   ```bash
   # Format code
   pnpm format

   # Lint code
   pnpm lint

   # Type check
   pnpm check-types
   ```

For more detailed instructions, see the [Development Guide](./DEVELOPMENT.md).

## Services & Applications

Atlas currently includes the following microservices:

### Core Services
- **cyclist-profile** (Port 3000) - Cyclist profile management API
- **cyclist-counts** (Port 3002) - Cyclist counting data and locations
- **bicycle-racks** (Port 3004) - Bicycle parking facilities management
- **cycling-infra** (Port 3020) - Cycling infrastructure and OpenStreetMap data

### Traffic & Safety Services
- **traffic-violations** (Port 3013) - Traffic violation data analysis
- **traffic-calls** (Port 3019) - Traffic-related emergency calls (SAMU)
- **traffic-deaths** (Port 3003) - DATASUS traffic mortality data
- **traffic-crashes** - Traffic accident data and analysis
- **emergency-calls** (Port 3010) - Emergency response call management

### Data Services
- **shared-bike** (Port 3015) - Shared bicycle system data
- **pcr-streets** (Port 3016) - Street and road network data
- **ciclodados** (Port 3050) - Cycling data aggregation service

### Documentation & Tools
- **docs** (Port 3001) - Unified API documentation site
- **create-atlas-app** - Service scaffolding tool

## Directory Structure

```
atlas/
├── .github/                    # GitHub Actions workflows
├── apps/                       # Microservices
│   ├── docs/                   # API documentation site
│   ├── cyclist-profile/        # Cyclist profile service
│   ├── cyclist-counts/         # Cyclist counting data
│   ├── bicycle-racks/          # Bicycle parking facilities
│   ├── cycling-infra/          # Cycling infrastructure
│   ├── traffic-violations/     # Traffic violation analysis
│   ├── traffic-calls/          # Emergency traffic calls
│   ├── traffic-deaths/         # DATASUS mortality data
│   ├── traffic-crashes/        # Traffic accident data
│   ├── emergency-calls/        # Emergency response calls
│   ├── shared-bike/            # Shared bicycle systems
│   ├── pcr-streets/            # Street network data
│   └── ciclodados/             # Cycling data aggregation
├── packages/                   # Shared packages
│   ├── database/               # Shared database with Drizzle ORM
│   ├── typescript-config/      # Shared TypeScript configuration
│   └── create-atlas-app/       # Service scaffolding tool
├── deployment/                 # Deployment configurations
│   └── portainer/              # Portainer stack configurations
├── docs/                       # Documentation
├── specs/                      # OpenAPI specifications
├── scripts/                    # Utility scripts
├── .tool-versions              # Tool versions for mise
├── biome.json                  # Code formatting configuration
├── turbo.json                  # Turborepo configuration
└── pnpm-workspace.yaml         # PNPM workspace configuration
```

## Architecture & Database

### Database Strategy

Atlas uses a **single database with shared schema** approach:

- **Single Database**: All services connect to the `atlas` database
- **Public Schema**: All tables reside in the default `public` schema
- **Shared Tables**: Services can query each other's tables when needed
- **Centralized Migrations**: Managed through the `@atlas/database` package
- **Type Safety**: Drizzle ORM provides type-safe queries across all services

### Request Flow

```
Client Request → Hono Router → Route Handler → Drizzle ORM → PostgreSQL → Response
```

### Key Benefits

- ✅ Single database to manage and backup
- ✅ Cross-service queries possible
- ✅ Simplified local development
- ✅ Type-safe database operations
- ✅ Centralized schema management

## CI/CD Pipeline

The CI/CD pipeline is designed for efficiency and reliability:

### Build Process
1. **Lint & Format**: Biome checks code quality
2. **Type Check**: TypeScript compilation
3. **Test**: Vitest runs unit and integration tests
4. **Build**: Turborepo builds only affected packages

### Docker Strategy
1. **Smart Detection**: Only builds images for changed services
2. **Multi-stage Builds**: Optimized production images
3. **Registry**: Images pushed to GitHub Container Registry (ghcr.io)
4. **Tagging**: SHA-based tags plus `latest` for main branch

### OpenAPI Generation
1. **Database Setup**: PostgreSQL starts in CI
2. **Migrations**: Database schema created
3. **Spec Generation**: OpenAPI specs generated with real database
4. **Auto-commit**: Specs committed back to repository

### Deployment
1. **Portainer Webhooks**: Automatic deployment via webhooks
2. **Independent Services**: Each service deploys separately
3. **Migration Handling**: Database migrations run before service updates

## Data Sources & Coverage

Atlas integrates multiple data sources for comprehensive urban mobility analysis:

### Geographic Coverage
- **Primary Focus**: Recife Metropolitan Region (RMR), Pernambuco, Brazil
- **Extended Coverage**: Other Brazilian cities with available data
- **Coordinate System**: WGS84 with PostGIS spatial extensions

### Data Sources
- **DATASUS**: Brazilian health system mortality data (320,320+ traffic death records)
- **SAMU**: Emergency medical service call data
- **OpenStreetMap**: Cycling infrastructure and street network data
- **Municipal Data**: Traffic violations, bicycle rack locations
- **Field Surveys**: Cyclist counting campaigns and profile data

### Key Datasets
- Traffic deaths (2015-2023): 320,320 records with CID-10 classification
- Emergency calls: Comprehensive SAMU call database
- Cycling infrastructure: OSM-based cycling network analysis
- Cyclist counts: Field survey data from counting campaigns
- Traffic violations: Municipal traffic enforcement data

## API Documentation

All APIs are documented with auto-generated OpenAPI specifications:

- **Unified Documentation**: Available at the docs service (Port 3001)
- **Interactive Testing**: Scalar API Reference interface
- **Type Safety**: Generated from TypeScript schemas
- **Real-time Updates**: Specs regenerated on every deployment

### Example API Endpoints

```bash
# Cyclist counting data
GET /v1/locations?city=Recife
GET /v1/events/{id}/sessions

# Traffic mortality analysis
GET /v1/deaths/by-transport-mode?year=2023
GET /v1/deaths/time-series?city_code=2611606

# Emergency calls
GET /samu-calls/summary
GET /samu-calls/streets/top?limite=50

# Infrastructure data
GET /cyclist-infra/relations
GET /cyclist-infra/ways/summary
```

## Docker Deployment

All services are containerized and available via GitHub Container Registry:

```bash
# Pull and run a service
docker pull ghcr.io/ameciclo/atlas/cyclist-profile:latest
docker run -p 3000:3000 --env-file .env ghcr.io/ameciclo/atlas/cyclist-profile:latest

# Run database operations
docker run --env-file .env ghcr.io/ameciclo/atlas/cyclist-profile:latest \
  node packages/database/dist/migrate.js
```

### Available Images
- `ghcr.io/ameciclo/atlas/cyclist-profile`
- `ghcr.io/ameciclo/atlas/cyclist-counts`
- `ghcr.io/ameciclo/atlas/traffic-deaths`
- `ghcr.io/ameciclo/atlas/docs`
- And more for each service...

## Monitoring & Health Checks

All Atlas services include comprehensive health monitoring:

### Health Endpoints
Every service exposes a standardized health check:

```bash
GET /health
```

Response format:
```json
{
  "status": "ok",
  "timestamp": "2023-07-01T12:34:56.789Z",
  "service": "cyclist-profile",
  "database": "connected"
}
```

### Service Status Monitoring
```bash
# Check all service health
node scripts/test-health.js

# Test database connections
node scripts/test-connections.js

# Check port availability
node scripts/check-ports.js
```

### Production Monitoring
- **Container Health**: Docker health checks for all services
- **Database Monitoring**: Connection pooling and query performance
- **API Metrics**: Response times and error rates
- **Log Aggregation**: Structured logging with Pino

## Performance & Scalability

### Build Performance
- **Turborepo Caching**: Intelligent build caching across services
- **Affected Builds**: Only builds changed services
- **Parallel Execution**: Up to 16 concurrent build processes
- **Docker Layer Caching**: Optimized container builds

### Database Performance
- **Connection Pooling**: Efficient database connection management
- **Query Optimization**: Type-safe queries with Drizzle ORM
- **Spatial Indexing**: PostGIS spatial indexes for geographic queries
- **Migration Strategy**: Zero-downtime database updates

### API Performance
- **Type Safety**: Compile-time validation reduces runtime errors
- **Efficient Routing**: Hono's lightweight routing engine
- **Response Caching**: Strategic caching for expensive operations
- **Compression**: Automatic response compression

## Security

### API Security
- **Input Validation**: Zod schema validation on all endpoints
- **Type Safety**: TypeScript prevents common vulnerabilities
- **Environment Isolation**: Separate configurations per environment
- **Health Check Security**: Non-sensitive health information only

### Database Security
- **Connection Security**: SSL/TLS database connections in production
- **Query Safety**: Parameterized queries via Drizzle ORM
- **Access Control**: Service-level database access patterns
- **Data Validation**: Schema-level data integrity

### Container Security
- **Multi-stage Builds**: Minimal production images
- **Non-root Users**: Containers run as non-privileged users
- **Dependency Scanning**: Automated vulnerability scanning
- **Image Signing**: Signed container images

## Contributing

We welcome contributions to the Atlas project! Here's how you can contribute:

### Development Workflow

1. **Fork the repository** and clone it locally
2. **Create a new branch** for your feature or bugfix
3. **Make your changes** following our code style guidelines
4. **Write or update tests** as necessary
5. **Run the test suite** to ensure everything passes
6. **Submit a pull request** with a clear description of the changes

### Code Style and Quality

We use Biome for code formatting and linting:

```bash
# Format code
pnpm format

# Lint code
pnpm lint
```

All code must pass type checking:

```bash
pnpm check-types
```

### Git Hooks

We use Husky for Git hooks to ensure code quality before commits:

- **pre-commit**: Runs linting and formatting
- **pre-push**: Runs type checking and tests

### Adding a New Service

Atlas provides a powerful scaffolding tool for creating new services:

```bash
# Interactive mode with prompts
pnpm create-atlas-app

# Direct creation
pnpm create-atlas-app my-service
```

#### What the tool generates:
- ✅ **Complete Service Structure**: TypeScript, Hono, Zod OpenAPI setup
- ✅ **Database Integration**: Optional PostgreSQL with Drizzle ORM
- ✅ **Docker Configuration**: Multi-stage Dockerfile and docker-compose.yml
- ✅ **Testing Setup**: Vitest configuration with example tests
- ✅ **Documentation**: Comprehensive README and OpenAPI specs
- ✅ **CI/CD Integration**: Automatic detection by GitHub Actions
- ✅ **Development Tools**: Hot reload, linting, formatting
- ✅ **Production Ready**: Health checks, logging, error handling

#### Generated structure:
```
apps/my-service/
├── src/
│   ├── app.ts              # Hono app configuration
│   ├── index.ts            # Entry point
│   ├── env.ts              # Environment validation
│   ├── db/                 # Database setup (optional)
│   ├── routes/             # API routes
│   └── middlewares/        # Custom middleware
├── test/                   # Test files
├── Dockerfile              # Production container
├── docker-compose.yml      # Development setup
└── README.md               # Service documentation
```

For detailed instructions, see [docs/CREATE_NEW_SERVICE.md](docs/CREATE_NEW_SERVICE.md) and [packages/create-atlas-app/README.md](packages/create-atlas-app/README.md).

### Adding a New Service

Atlas provides a powerful scaffolding tool for creating new services:

```bash
# Interactive mode with prompts
pnpm create-atlas-app

# Direct creation
pnpm create-atlas-app my-service
```

#### What the tool generates:
- ✅ **Complete Service Structure**: TypeScript, Hono, Zod OpenAPI setup
- ✅ **Database Integration**: Optional PostgreSQL with Drizzle ORM
- ✅ **Docker Configuration**: Multi-stage Dockerfile and docker-compose.yml
- ✅ **Testing Setup**: Vitest configuration with example tests
- ✅ **Documentation**: Comprehensive README and OpenAPI specs
- ✅ **CI/CD Integration**: Automatic detection by GitHub Actions
- ✅ **Development Tools**: Hot reload, linting, formatting
- ✅ **Production Ready**: Health checks, logging, error handling

#### Generated structure:
```
apps/my-service/
├── src/
│   ├── app.ts              # Hono app configuration
│   ├── index.ts            # Entry point
│   ├── env.ts              # Environment validation
│   ├── db/                 # Database setup (optional)
│   ├── routes/             # API routes
│   └── middlewares/        # Custom middleware
├── test/                   # Test files
├── Dockerfile              # Production container
├── docker-compose.yml      # Development setup
└── README.md               # Service documentation
```

For detailed instructions, see [docs/CREATE_NEW_SERVICE.md](docs/CREATE_NEW_SERVICE.md) and [packages/create-atlas-app/README.md](packages/create-atlas-app/README.md).

## Resources & Documentation

### Key Documentation
- [Architecture Overview](./ARCHITECTURE_OVERVIEW.md) - Detailed system architecture
- [Development Guide](./DEVELOPMENT.md) - Local development setup
- [Database Usage](./packages/database/USAGE.md) - Database management guide
- [Deployment Strategy](./DEPLOYMENT_STRATEGY.md) - Production deployment
- [API Documentation](./ALL_APIS.md) - Complete API reference

### Service-Specific Docs
- [Creating New Services](./docs/CREATE_NEW_SERVICE.md)
- [Scaffolding Tool](./packages/create-atlas-app/README.md)
- [OpenAPI Workflow](./docs/OPENAPI_WORKFLOW.md)

### Deployment Guides
- [Portainer Setup](./deployment/README.md)
- [Single Stack Deployment](./deployment/SINGLE_STACK_SETUP.md)
- [Kong API Gateway](./deployment/KONG_SETUP.md)

## Support & Community

### Getting Help
- **Issues**: Report bugs and request features via GitHub Issues
- **Discussions**: Join discussions for questions and ideas
- **Documentation**: Check the comprehensive docs in the `/docs` folder

### Project Status
- **Active Development**: Regularly updated and maintained
- **Production Ready**: Used in production environments
- **Open Source**: AGPL-3.0 licensed for community contributions

### Related Projects
- **Ameciclo**: Non-profit organization promoting cycling in Brazil
- **OpenStreetMap**: Collaborative mapping project for infrastructure data
- **DATASUS**: Brazilian health system data integration

## License

This project is licensed under the GNU Affero General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

---

[GitHubStars]: https://img.shields.io/github/stars/ameciclo/atlas
[GitHubLicense]: https://img.shields.io/github/license/ameciclo/atlas
[GitHubLicenseUrl]: https://github.com/ameciclo/atlas/blob/main/LICENSE
[GitHubRepo]: https://github.com/ameciclo/atlas
