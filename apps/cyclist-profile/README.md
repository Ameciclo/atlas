## Cyclist Profile API

### Requirements

- Node.js 22.15.0
- pnpm 10.10.0

We recommend using [mise](https://mise.jdx.dev/) for managing tool versions. A `.tool-versions` file is included in the repository.

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
pnpm db:generate

# Apply migrations
pnpm db:migrate

# View database with Drizzle Studio
pnpm db:studio

# Seed the database with sample data
pnpm db:seed
```

```
open http://localhost:3000
```

### Docker Deployment

The Cyclist Profile API can be deployed as a Docker container. The container image is automatically built and pushed to GitHub Container Registry (ghcr.io) when changes are merged to the main branch.

#### Running with Docker

To run the Cyclist Profile API using Docker:

```bash
# Pull the latest image
docker pull ghcr.io/ameciclo/atlas/cyclist-profile:latest

# Run the container with PostgreSQL
docker compose up -d
```

The API will be available at http://localhost:3000

#### Building Locally

You can also build and run the Docker image locally:

```bash
# From the cyclist-profile app directory
docker compose up -d

# Or from the root of the monorepo
docker build -t atlas-cyclist-profile -f apps/cyclist-profile/Dockerfile .
docker run -p 3000:3000 --env-file .env atlas-cyclist-profile
```

#### Environment Variables for Docker

When running the Docker container, you'll need to set these environment variables:

- `NODE_ENV` - Set to "production" for production deployment
- `LOG_LEVEL` - Logging level (default: "info")
- `PORT` - The port on which the server will listen (default: 3000)
- `DB_HOST` - PostgreSQL host
- `DB_PORT` - PostgreSQL port (default: 5432)
- `DB_USER` - PostgreSQL user
- `DB_PASSWORD` - PostgreSQL password
- `DB_NAME` - PostgreSQL database name
- `DATABASE_URL` - PostgreSQL connection string (alternative to individual DB settings)
- `DB_SSL` - Set to "true" to enable SSL for database connection (default: "false")

#### Database Migrations and Seeding

The Docker image can be used directly for migrations and seeding by overriding the default command. This approach allows you to reuse the same image for different purposes:

1. **Running the API**: Use the default command
2. **Running Migrations**: Override the command to run migrations
3. **Seeding the Database**: Override the command to seed the database

For local development with Docker Compose:

```bash
# Start the application with migrations
docker compose up -d

# Start with seeding (optional)
docker compose --profile with-seed up -d
```

For Portainer deployment:

```yaml
# Example Portainer stack configuration
version: '3'
services:
  app:
    image: ghcr.io/ameciclo/atlas/cyclist-profile:latest
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
      - PORT=8080  # Custom port for Kong API Gateway
      - DATABASE_URL=postgres://user:password@db-host:5432/atlas_db
    ports:
      - "8080:8080"  # Map the custom port
    depends_on:
      - migrate
    restart: unless-stopped

  migrate:
    image: ghcr.io/ameciclo/atlas/cyclist-profile:latest
    command: node apps/cyclist-profile/dist/db/migrate.js
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgres://user:password@db-host:5432/atlas_db
    restart: on-failure
```

For the first deployment, you might want to include a seeding service:

```yaml
  seed:
    image: ghcr.io/ameciclo/atlas/cyclist-profile:latest
    command: node apps/cyclist-profile/dist/db/seed.js
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgres://user:password@db-host:5432/atlas_db
    depends_on:
      - migrate
    restart: on-failure
```

### Health Check Endpoint

The API includes an undocumented health check endpoint that can be used for monitoring and integration with Kong API Gateway:

```
GET /health
```

The health check endpoint returns:

```json
{
  "status": "ok",
  "timestamp": "2023-07-01T12:34:56.789Z",
  "service": "cyclist-profile",
  "database": "connected"
}
```

If there's an issue with the database connection, it returns a 503 status code with:

```json
{
  "status": "error",
  "timestamp": "2023-07-01T12:34:56.789Z",
  "service": "cyclist-profile",
  "database": "disconnected",
  "error": "Error message"
}
```

#### Kong API Gateway Integration

For Kong API Gateway, you can configure a health check using this endpoint:

```yaml
services:
  - name: cyclist-profile
    url: http://cyclist-profile:8080
    routes:
      - name: cyclist-profile-route
        paths:
          - /cyclist-profile
    healthchecks:
      active:
        http_path: /health
        healthy:
          interval: 10
          successes: 2
        unhealthy:
          interval: 5
          http_failures: 2
```
