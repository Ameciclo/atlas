# Development Guide

This guide will help you set up your local development environment for the Atlas monorepo.

## Prerequisites

- **Node.js**: v22.15.0 (managed via mise)
- **pnpm**: v10.10.0
- **Docker**: For running PostgreSQL locally
- **mise**: For managing tool versions (optional but recommended)

## Quick Start

### 1. Install Dependencies

```bash
# Install mise (if not already installed)
curl https://mise.run | sh

# Install Node.js and other tools from .mise.toml
mise install

# Install pnpm dependencies
pnpm install
```

### 2. Start the Database

```bash
# Start PostgreSQL with PostGIS
docker-compose up -d

# Verify it's running
docker-compose ps
```

### 3. Run Migrations

```bash
# Run all database migrations
pnpm --filter @atlas/database db:migrate

# Or use the shortcut
pnpm db:migrate
```

### 4. Seed the Database (Optional)

```bash
# Seed cyclist profile data
pnpm --filter @atlas/cyclist-profile db:seed
```

### 5. Start Development Server

```bash
# Start a specific app
pnpm --filter @atlas/cyclist-profile dev

# Or start all apps
pnpm dev
```

## Database Management

### Shared Database Architecture

All services connect to a single `atlas` database. Each service owns its own PostgreSQL schema:

```
atlas database
├── cyclist_profile schema (cyclist-profile service)
├── analytics schema (analytics service)
└── notifications schema (notifications service)
```

### Common Database Commands

```bash
# Generate new migration (after changing schema)
pnpm --filter @atlas/database db:generate

# Run migrations
pnpm --filter @atlas/database db:migrate

# Open Drizzle Studio (database GUI)
pnpm --filter @atlas/database db:studio

# Seed data for a specific service
pnpm --filter @atlas/cyclist-profile db:seed
```

### Database Connection

All services use the same `DATABASE_URL`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/atlas
```

### Resetting the Database

```bash
# Stop and remove the database
docker-compose down -v

# Start fresh
docker-compose up -d

# Run migrations
pnpm --filter @atlas/database db:migrate

# Seed data
pnpm --filter @atlas/cyclist-profile db:seed
```

## Building and Testing

### Build

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @atlas/cyclist-profile build

# Build only changed packages
pnpm build --affected
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @atlas/cyclist-profile test

# Run tests in watch mode
pnpm --filter @atlas/cyclist-profile test:watch
```

### Type Checking

```bash
# Check types for all packages
pnpm check-types

# Check types for specific package
pnpm --filter @atlas/cyclist-profile check-types
```

### Linting and Formatting

```bash
# Check code style
pnpm biome:check

# Fix code style issues
pnpm biome:fix

# Format code
pnpm format
```

## OpenAPI Documentation

### Generating OpenAPI Specs

OpenAPI specs are automatically generated in CI/CD, but you can generate them locally:

```bash
# Ensure database is running and migrated
docker-compose up -d
pnpm --filter @atlas/database db:migrate

# Generate OpenAPI spec
pnpm --filter @atlas/cyclist-profile generate-openapi
```

The spec will be saved to `apps/docs/public/openapi/cyclist-profile.json`.

### Viewing OpenAPI Docs

```bash
# Start the docs app
pnpm --filter @atlas/docs dev

# Open http://localhost:3001 in your browser
```

## Working with the Monorepo

### Adding a New Package

```bash
# Use the generator (when available)
pnpm create-atlas-app

# Or manually create in apps/ or packages/
```

### Adding Dependencies

```bash
# Add to specific package
pnpm --filter @atlas/cyclist-profile add express

# Add to root (for tooling)
pnpm add -D -w typescript

# Add workspace dependency
pnpm --filter @atlas/cyclist-profile add @atlas/database
```

### Running Commands

```bash
# Run in specific package
pnpm --filter @atlas/cyclist-profile <command>

# Run in all packages
pnpm -r <command>

# Run only in changed packages
pnpm <command> --affected
```

## Troubleshooting

### Database Connection Issues

**Problem**: `ECONNREFUSED` or `database "atlas" does not exist`

**Solution**:
```bash
# Check if PostgreSQL is running
docker-compose ps

# Restart PostgreSQL
docker-compose restart postgres

# Check logs
docker-compose logs postgres
```

### Migration Issues

**Problem**: Migration fails or schema doesn't exist

**Solution**:
```bash
# Reset database
docker-compose down -v
docker-compose up -d

# Run migrations again
pnpm --filter @atlas/database db:migrate
```

### Build Issues

**Problem**: Build fails with module not found

**Solution**:
```bash
# Clean and reinstall
rm -rf node_modules
pnpm install

# Build dependencies first
pnpm --filter @atlas/database build
pnpm --filter @atlas/cyclist-profile build
```

### Port Already in Use

**Problem**: `EADDRINUSE: address already in use :::3000`

**Solution**:
```bash
# Find process using the port
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=3001 pnpm --filter @atlas/cyclist-profile dev
```

## Environment Variables

### Required Variables

Each service needs a `.env` file. Copy from `.env.example`:

```bash
# For cyclist-profile
cp apps/cyclist-profile/.env.example apps/cyclist-profile/.env
```

### Common Variables

```env
# Node environment
NODE_ENV=development

# Server port
PORT=3000

# Database connection
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/atlas

# Logging
LOG_LEVEL=info
```

## Docker Development

### Building Docker Images

```bash
# Build cyclist-profile image
docker build -f apps/cyclist-profile/Dockerfile -t atlas-cyclist-profile .

# Build docs image
docker build -f apps/docs/Dockerfile -t atlas-docs .
```

### Running with Docker Compose

```bash
# Start specific service
docker-compose -f apps/cyclist-profile/docker-compose.yml up

# View logs
docker-compose -f apps/cyclist-profile/docker-compose.yml logs -f
```

## Best Practices

1. **Always run migrations** after pulling changes
2. **Use Turborepo filters** to work on specific packages
3. **Run tests** before committing
4. **Use Biome** for consistent code formatting
5. **Check types** before pushing
6. **Keep .env files** out of git (use .env.example)
7. **Document new features** in relevant README files

## Useful Commands Cheat Sheet

```bash
# Development
pnpm dev                                    # Start all apps
pnpm --filter @atlas/cyclist-profile dev   # Start specific app

# Database
docker-compose up -d                        # Start database
pnpm db:migrate                             # Run migrations
pnpm db:studio                              # Open database GUI

# Building
pnpm build                                  # Build all
pnpm build --affected                       # Build changed only

# Testing
pnpm test                                   # Run all tests
pnpm test --affected                        # Test changed only

# Code Quality
pnpm biome:check                            # Check formatting
pnpm biome:fix                              # Fix formatting
pnpm check-types                            # Type check all

# Cleanup
pnpm clean                                  # Clean build artifacts
docker-compose down -v                      # Reset database
```

## Getting Help

- **Documentation**: Check README files in each package
- **Database**: See `packages/database/USAGE.md`
- **CI/CD**: See `.github/workflows/README.md`
- **Migration Guide**: See `MIGRATION_TO_SHARED_DB.md`

## Next Steps

- Read the [Database Usage Guide](./packages/database/USAGE.md)
- Explore the [API Documentation](http://localhost:3001) (after starting docs app)
- Check out the [CI/CD Workflows](./.github/workflows/README.md)

