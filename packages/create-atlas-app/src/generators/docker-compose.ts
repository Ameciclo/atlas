import type { AppConfig } from "../create-app.js";

export function generateDockerCompose(config: AppConfig): string {
  if (!config.includeDatabase) {
    return `services:
  app:
    image: atlas-${config.name}
    build:
      context: ../..
      dockerfile: ./apps/${config.name}/Dockerfile
    ports:
      - "\${PORT:-${config.port}}:\${PORT:-${config.port}}"
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
      - PORT=\${PORT:-${config.port}}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:${config.port}/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
`;
  }

  return `services:
  app:
    image: atlas-${config.name}
    build:
      context: ../..
      dockerfile: ./apps/${config.name}/Dockerfile
    ports:
      - "\${PORT:-${config.port}}:\${PORT:-${config.port}}"
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
      - PORT=\${PORT:-${config.port}}
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_USER=postgres
      - DB_PASSWORD=postgres
      - DB_NAME=${config.databaseName}
      - DATABASE_URL=postgres://postgres:postgres@postgres:5432/${config.databaseName}
    depends_on:
      migrate:
        condition: service_completed_successfully
      seed:
        condition: service_completed_successfully
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:${config.port}/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  migrate:
    image: atlas-${config.name}
    build:
      context: ../..
      dockerfile: ./apps/${config.name}/Dockerfile
    command: node apps/${config.name}/dist/db/migrate.js
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_USER=postgres
      - DB_PASSWORD=postgres
      - DB_NAME=${config.databaseName}
      - DATABASE_URL=postgres://postgres:postgres@postgres:5432/${config.databaseName}
    depends_on:
      postgres:
        condition: service_healthy
    restart: on-failure

  seed:
    image: atlas-${config.name}
    build:
      context: ../..
      dockerfile: ./apps/${config.name}/Dockerfile
    command: node apps/${config.name}/dist/db/seed.js
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_USER=postgres
      - DB_PASSWORD=postgres
      - DB_NAME=${config.databaseName}
      - DATABASE_URL=postgres://postgres:postgres@postgres:5432/${config.databaseName}
    depends_on:
      migrate:
        condition: service_completed_successfully
    restart: on-failure
    profiles:
      - with-seed

  postgres:
    image: postgis/postgis:16-3.4-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=${config.databaseName}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
`;
}
