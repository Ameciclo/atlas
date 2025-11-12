# Atlas Project

[![][GitHubStars]][GitHubRepo]
[![][GitHubLicense]][GitHubLicenseUrl]
[![CI Status](https://github.com/ameciclo/atlas/actions/workflows/ci.yml/badge.svg)](https://github.com/ameciclo/atlas/actions/workflows/ci.yml)
[![Docker Build Status](https://github.com/ameciclo/atlas/actions/workflows/docker.yml/badge.svg)](https://github.com/ameciclo/atlas/actions/workflows/docker.yml)

**A monorepo for Ameciclo's Atlas platform - a comprehensive solution for cyclist data management and analysis**

## Overview

This monorepo utilizes pnpm and Turbo for efficient development, building, and deployment of various applications and packages. It provides a standardized and maintainable environment for all projects within the Atlas ecosystem, focusing on cyclist data collection, analysis, and visualization.

## Technologies

* **Monorepo Management:** pnpm (https://pnpm.io/)
* **Build System & Caching:** Turbo (https://turbo.build/)
* **Code Standardization:** Biome (https://biomejs.dev/)
* **Languages:** TypeScript
* **API Frameworks:** Hono, Zod OpenAPI
* **Database:** PostgreSQL with Drizzle ORM
* **Documentation:** Scalar API Reference
* **Containerization:** Docker
* **CI/CD:** GitHub Actions

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
   ```

5. **Building:**
   ```bash
   # Build all applications/packages
   pnpm build

   # Or build a specific application
   pnpm --filter @atlas/cyclist-profile build
   ```

6. **Testing:**
   ```bash
   # Run all tests
   pnpm test

   # Or test a specific application
   pnpm --filter @atlas/cyclist-profile test
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

8. **OpenAPI Documentation:**
   ```bash
   # Auto-discover and generate all OpenAPI specs
   pnpm generate-openapi

   # Specs are automatically copied to the docs app
   # View them at http://localhost:5173 (after running pnpm --filter @atlas/docs dev)
   ```

For more detailed instructions, see the [Development Guide](./DEVELOPMENT.md).

## Directory Structure

```
atlas/
├── .github/             # GitHub configuration
│   └── workflows/       # GitHub Actions workflows
├── apps/                # Applications
│   ├── docs/            # API documentation site
│   └── cyclist-profile/ # Cyclist profile service
├── docs/                # Documentation
│   ├── CREATE_NEW_SERVICE.md          # Guide for creating new services
│   ├── SCAFFOLDING_TOOL.md            # Scaffolding tool documentation
│   └── SUMMARY.md                     # Documentation index
├── packages/            # Shared packages
│   ├── database/            # Shared database package with Drizzle ORM
│   ├── typescript-config/   # Shared TypeScript configuration
│   └── create-atlas-app/    # Scaffolding tool for new services
├── .tool-versions       # Tool versions for mise
├── biome.json           # Biome configuration
├── turbo.json           # Turborepo configuration
└── pnpm-workspace.yaml  # PNPM workspace configuration
```

## CI/CD Pipeline

The CI/CD pipeline uses GitOps principles with GitHub Actions and ArgoCD:

1. **Semantic Versioning**: Automated releases using conventional commits and Release Please

2. **Smart Dependency Detection**:
   - Uses Turborepo's `--affected` flag to only process packages that have changed
   - Compares with the base branch for PRs or the previous commit for pushes to main
   - Automatically detects which apps need to be built and deployed

3. **GitOps Deployment**:
   - **Staging**: Auto-deploys on every main branch push
   - **Production**: Auto-deploys on semantic releases + manual deployment option
   - **ArgoCD**: Monitors groundwork repository and syncs changes automatically

3. **Efficient Docker Builds**:
   - Only builds Docker images for applications that have changed
   - Uses GitHub Actions caching for faster builds
   - Pushes images to GitHub Container Registry (ghcr.io)
   - Tags images with commit SHA, branch name, and 'latest' for main branch

4. **GitOps Deployment**:
   - Staging environment auto-deploys on every main branch push
   - Production deploys on semantic releases or manual triggers
   - ArgoCD monitors groundwork repository for automatic synchronization
   - Database migrations and seeding are handled by reusing the same Docker image with different commands

## Deployment

Atlas uses a GitOps deployment strategy with ArgoCD:

- **Documentation**: [GitOps Deployment Guide](docs/GITOPS_DEPLOYMENT.md)
- **Staging**: `docs-staging.ameciclo.org` (auto-deployed on main branch)
- **Production**: `docs.ameciclo.org` (deployed on releases or manually)
- **Infrastructure**: Managed via [Groundwork Repository](https://github.com/ameciclo/groundwork)

### Database Architecture

Atlas uses a **shared database with single schema** approach:

- **Single Database**: All services connect to the `atlas` database
- **Public Schema**: All tables reside in the default `public` schema
- **Shared Tables**: Services can query each other's tables when needed
- **Centralized Migrations**: Managed through the `@atlas/database` package

See [Database Usage Guide](./packages/database/USAGE.md) for details.

### OpenAPI Auto-Discovery

Atlas features an **automatic OpenAPI discovery system** that eliminates manual registration:

**How it works:**
- Apps are auto-discovered if they have:
  1. A `generate-openapi` script in `package.json`
  2. A `src/generate-openapi.ts` file
- Running `pnpm generate-openapi` automatically finds and generates specs for all API apps
- No manual registration needed - just create the files and you're done!

**Benefits:**
- ✅ Zero configuration - new apps are automatically discovered
- ✅ Consistent behavior across all API services
- ✅ Single command generates all OpenAPI specs
- ✅ Specs are automatically copied to the docs app

See [OpenAPI Discovery Documentation](./docs/OPENAPI_DISCOVERY.md) for details.

### Docker Deployment

For deployment, we use Docker images that are built and pushed to GitHub Container Registry:

```bash
# Pull the latest image for an app
docker pull ghcr.io/ameciclo/atlas/cyclist-profile:latest

# Run the container
docker run -p 3000:3000 --env-file .env ghcr.io/ameciclo/atlas/cyclist-profile:latest
```

The same image can be used for different purposes by overriding the command:

```bash
# Run database migrations
docker run --env-file .env ghcr.io/ameciclo/atlas/cyclist-profile:latest node apps/cyclist-profile/dist/db/migrate.js

# Seed the database
docker run --env-file .env ghcr.io/ameciclo/atlas/cyclist-profile:latest node apps/cyclist-profile/dist/db/seed.js
```

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

We provide a scaffolding tool to quickly create new services with all the necessary boilerplate:

```bash
# Interactive mode
pnpm create-atlas-app

# With service name
pnpm create-atlas-app my-service
```

The tool will:
- ✅ Generate complete service structure with TypeScript, Hono, and Zod OpenAPI
- ✅ Create Dockerfile and docker-compose.yml
- ✅ Set up database with Drizzle ORM (optional)
- ✅ Add example routes, tests, and documentation
- ✅ Configure CI/CD integration automatically

For detailed instructions, see [docs/CREATE_NEW_SERVICE.md](docs/CREATE_NEW_SERVICE.md) and [docs/SCAFFOLDING_TOOL.md](docs/SCAFFOLDING_TOOL.md).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

[GitHubStars]: https://img.shields.io/github/stars/ameciclo/atlas
[GitHubLicense]: https://img.shields.io/github/license/ameciclo/atlas
[GitHubLicenseUrl]: https://github.com/ameciclo/atlas/blob/main/LICENSE
[GitHubRepo]: https://github.com/ameciclo/atlas
