# Docker Development Environment

This package provides convenient scripts for managing the development database.

## Quick Start

```bash
# Start the database
pnpm --filter @atlas/docker-dev dev

# View logs
pnpm --filter @atlas/docker-dev logs

# Stop the database
pnpm --filter @atlas/docker-dev stop

# Reset the database (WARNING: deletes all data)
pnpm --filter @atlas/docker-dev db:reset
```

## What's Running?

- **PostgreSQL 16** with **PostGIS 3.5** extension
- Database: `atlas_dev`
- Port: `5432`
- User: `postgres`
- Password: `postgres`

## Connection String

```
postgresql://postgres:postgres@localhost:5432/atlas_dev
```

## Notes

- The actual `docker-compose.yml` is at the repository root
- This package is just a convenience wrapper for Turborepo integration
- Data is persisted in a Docker volume named `atlas-postgres-data`
- PostGIS is included for geospatial data support (locations, coordinates, etc.)

## Troubleshooting

### ARM64 Macs (Apple Silicon)

The PostGIS image uses `platform: linux/amd64` which runs via Rosetta emulation.
This is slower but ensures compatibility. If you experience issues, you can:

1. Use a native ARM64 PostgreSQL with PostGIS installed separately
2. Wait for official ARM64 PostGIS images
3. Build a custom ARM64 PostGIS image

### Port Already in Use

If port 5432 is already in use:

```bash
# Check what's using the port
lsof -i :5432

# Stop any local PostgreSQL
brew services stop postgresql
```

