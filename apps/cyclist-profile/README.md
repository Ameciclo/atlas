## Cyclist Profile API

### Development with Docker

The easiest way to get started is using Docker Compose:

```bash
# Start the application and database
docker compose up -d

# Run database migrations
docker compose exec app pnpm migrate

# View logs
docker compose logs -f

# Stop the application
docker compose down
```

### Manual Setup

If you prefer to run the application without Docker:

```bash
# Install dependencies
pnpm install

# Start the development server
pnpm dev

# In another terminal, run migrations
pnpm migrate
```

The application will be available at http://localhost:3000

### Environment Variables

The following environment variables can be configured:

- `DB_HOST` - PostgreSQL host (default: localhost)
- `DB_PORT` - PostgreSQL port (default: 5432)
- `DB_USER` - PostgreSQL user (default: postgres)
- `DB_PASSWORD` - PostgreSQL password (default: postgres)
- `DB_NAME` - PostgreSQL database name (default: cyclist_profile)

### Database Management

```bash
# Generate new migrations
pnpm generate

# Apply migrations
pnpm migrate

# View database with Drizzle Studio
pnpm studio
```

```
open http://localhost:3000
```
