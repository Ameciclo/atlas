# Quick Start Guide

Get up and running with Atlas in 5 minutes.

## Prerequisites

- Node.js 22.15.0
- pnpm 10.10.0
- Docker

## Setup

```bash
# 1. Clone and install
git clone https://github.com/ameciclo/atlas.git
cd atlas
pnpm install

# 2. Start database
docker-compose up -d

# 3. Run migrations
pnpm --filter @atlas/database db:migrate

# 4. Start development
pnpm dev
```

## Common Commands

### Database

```bash
# Start database
docker-compose up -d

# Stop database
docker-compose down

# Reset database (⚠️ deletes all data)
docker-compose down -v && docker-compose up -d

# Run migrations
pnpm --filter @atlas/database db:migrate

# Generate new migration
pnpm --filter @atlas/database db:generate

# Open database GUI
pnpm --filter @atlas/database db:studio

# Seed data
pnpm --filter @atlas/cyclist-profile db:seed
```

### Development

```bash
# Start all apps
pnpm dev

# Start specific app
pnpm --filter @atlas/cyclist-profile dev

# Build all
pnpm build

# Build specific app
pnpm --filter @atlas/cyclist-profile build

# Run tests
pnpm test

# Type check
pnpm check-types

# Format code
pnpm biome:fix
```

### OpenAPI

```bash
# Generate OpenAPI spec (requires database)
pnpm --filter @atlas/cyclist-profile generate-openapi

# View docs
pnpm --filter @atlas/docs dev
# Then open http://localhost:3001
```

## Environment Variables

Copy `.env.example` to `.env` in each app:

```bash
cp apps/cyclist-profile/.env.example apps/cyclist-profile/.env
```

Key variable:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/atlas
```

## Project Structure

```
atlas/
├── apps/
│   ├── cyclist-profile/    # API service
│   └── docs/               # API documentation
├── packages/
│   ├── database/           # Shared database (Drizzle ORM)
│   ├── typescript-config/  # Shared TypeScript config
│   └── create-atlas-app/   # Service generator
└── docker-compose.yml      # Development database
```

## Database Architecture

- **One database**: `atlas`
- **Multiple schemas**: Each service owns a schema
  - `cyclist_profile` schema → cyclist-profile service
  - `analytics` schema → analytics service
  - etc.

## Troubleshooting

### Database won't start
```bash
docker-compose down -v
docker-compose up -d
```

### Build fails
```bash
pnpm install
pnpm --filter @atlas/database build
pnpm build
```

### Port already in use
```bash
# Find process
lsof -i :3000

# Kill it
kill -9 <PID>

# Or use different port
PORT=3001 pnpm dev
```

## Next Steps

- Read [DEVELOPMENT.md](./DEVELOPMENT.md) for detailed guide
- Check [packages/database/USAGE.md](./packages/database/USAGE.md) for database usage
- See [packages/database/SCHEMA_STRATEGY.md](./packages/database/SCHEMA_STRATEGY.md) for schema strategy

## Getting Help

- **Documentation**: Check README files in each package
- **Issues**: https://github.com/ameciclo/atlas/issues
- **CI/CD**: See `.github/workflows/README.md`

