# Deployment Guide

This guide explains how to deploy Atlas services to production using Portainer.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Docker Images](#docker-images)
3. [Portainer Setup](#portainer-setup)
4. [Database Deployment](#database-deployment)
5. [Service Deployment](#service-deployment)
6. [Webhook Deployment](#webhook-deployment)
7. [Environment Variables](#environment-variables)
8. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Deployment Strategy

```
GitHub Actions (CI/CD)
    ↓
Build Docker Images (per service)
    ↓
Push to GitHub Container Registry (GHCR)
    ↓
Portainer Webhooks
    ↓
Pull & Restart Services
```

### Services Architecture

```
Production Environment
├── PostgreSQL (shared database)
│   └── atlas database
│       ├── cyclist_profile schema
│       ├── analytics schema
│       └── notifications schema
├── cyclist-profile service
├── docs service
└── future services...
```

---

## Docker Images

### Image Naming Convention

All images are pushed to GitHub Container Registry:

```
ghcr.io/ameciclo/atlas/<service-name>:<tag>
```

**Examples:**
- `ghcr.io/ameciclo/atlas/cyclist-profile:latest`
- `ghcr.io/ameciclo/atlas/cyclist-profile:sha-abc1234`
- `ghcr.io/ameciclo/atlas/docs:latest`

### Image Tags

Each image is tagged with:
- `latest` - Latest version from main branch
- `sha-<commit>` - Specific commit SHA
- `main` - Main branch

### Building Images Locally

```bash
# Build cyclist-profile image
docker build -f apps/cyclist-profile/Dockerfile -t ghcr.io/ameciclo/atlas/cyclist-profile:latest .

# Build docs image
docker build -f apps/docs/Dockerfile -t ghcr.io/ameciclo/atlas/docs:latest .
```

---

## Portainer Setup

### Prerequisites

1. **Portainer Instance**: Running Portainer CE or Business
2. **GitHub Container Registry Access**: Personal Access Token (PAT) with `read:packages` permission
3. **Network**: Docker network for service communication

### Step 1: Create Docker Registry in Portainer

1. Go to **Registries** → **Add registry**
2. Select **Custom registry**
3. Configure:
   - **Name**: `GitHub Container Registry`
   - **Registry URL**: `ghcr.io`
   - **Authentication**: Yes
   - **Username**: Your GitHub username
   - **Password**: GitHub Personal Access Token (PAT)

### Step 2: Create Docker Network

```bash
docker network create atlas-network
```

Or in Portainer:
1. Go to **Networks** → **Add network**
2. **Name**: `atlas-network`
3. **Driver**: `bridge`

### Step 3: Create Volumes

```bash
# PostgreSQL data
docker volume create atlas-postgres-data
```

---

## Database Deployment

### Option 1: Portainer Stack (Recommended)

Create a stack named `atlas-database`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgis/postgis:16-3.5
    container_name: atlas-postgres
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: atlas
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    volumes:
      - atlas-postgres-data:/var/lib/postgresql/data
    networks:
      - atlas-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d atlas"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  atlas-postgres-data:
    external: true

networks:
  atlas-network:
    external: true
```

**Environment Variables:**
- `POSTGRES_PASSWORD`: Strong password for PostgreSQL
- `POSTGRES_PORT`: Port to expose (default: 5432)

### Option 2: Portainer Container

1. Go to **Containers** → **Add container**
2. Configure:
   - **Name**: `atlas-postgres`
   - **Image**: `postgis/postgis:16-3.5`
   - **Network**: `atlas-network`
   - **Volumes**: Map `atlas-postgres-data` to `/var/lib/postgresql/data`
   - **Env variables**: Set `POSTGRES_PASSWORD`, `POSTGRES_DB=atlas`
   - **Restart policy**: `unless-stopped`

### Running Migrations

Migrations should be run **once** after database deployment:

```bash
# Option 1: Run from local machine
DATABASE_URL=postgresql://postgres:password@your-server:5432/atlas \
  pnpm --filter @atlas/database db:migrate

# Option 2: Run as one-time container in Portainer
docker run --rm \
  --network atlas-network \
  -e DATABASE_URL=postgresql://postgres:password@atlas-postgres:5432/atlas \
  ghcr.io/ameciclo/atlas/cyclist-profile:latest \
  node -e "require('@atlas/database').runMigrations()"
```

**Important**: Migrations create all schemas automatically. You only need to run this once or when schema changes.

---

## Service Deployment

### Cyclist Profile Service

#### Portainer Stack

Create a stack named `atlas-cyclist-profile`:

```yaml
version: '3.8'

services:
  cyclist-profile:
    image: ghcr.io/ameciclo/atlas/cyclist-profile:latest
    container_name: atlas-cyclist-profile
    environment:
      NODE_ENV: production
      LOG_LEVEL: ${LOG_LEVEL:-info}
      PORT: ${PORT:-3000}
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@atlas-postgres:5432/atlas
    ports:
      - "${PORT:-3000}:${PORT:-3000}"
    networks:
      - atlas-network
    restart: unless-stopped
    depends_on:
      - postgres
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

networks:
  atlas-network:
    external: true
```

**Environment Variables:**
- `PORT`: Service port (default: 3000)
- `LOG_LEVEL`: Logging level (info, debug, error)
- `DATABASE_URL`: PostgreSQL connection string
- `POSTGRES_USER`: Database user
- `POSTGRES_PASSWORD`: Database password

#### Portainer Container

1. Go to **Containers** → **Add container**
2. Configure:
   - **Name**: `atlas-cyclist-profile`
   - **Image**: `ghcr.io/ameciclo/atlas/cyclist-profile:latest`
   - **Network**: `atlas-network`
   - **Port mapping**: `3000:3000`
   - **Env variables**: Set all required variables
   - **Restart policy**: `unless-stopped`

### Docs Service

Similar setup for docs service:

```yaml
version: '3.8'

services:
  docs:
    image: ghcr.io/ameciclo/atlas/docs:latest
    container_name: atlas-docs
    environment:
      NODE_ENV: production
      PORT: ${PORT:-3001}
    ports:
      - "${PORT:-3001}:${PORT:-3001}"
    networks:
      - atlas-network
    restart: unless-stopped

networks:
  atlas-network:
    external: true
```

---

## Webhook Deployment

Portainer webhooks allow automatic deployment when new images are pushed.

### Step 1: Create Webhook in Portainer

For each service:

1. Go to **Containers** → Select container (e.g., `atlas-cyclist-profile`)
2. Scroll to **Webhook** section
3. Click **Create webhook**
4. Copy the webhook URL (looks like: `https://portainer.example.com/api/webhooks/xxx-xxx-xxx`)

### Step 2: Store Webhooks as GitHub Secrets

Add these secrets to your GitHub repository:

- `PORTAINER_WEBHOOK_CYCLIST_PROFILE`
- `PORTAINER_WEBHOOK_DOCS`

### Step 3: Update GitHub Actions Workflow

The workflow will automatically call webhooks after pushing images.

See `.github/workflows/deploy.yml` for implementation.

### Manual Webhook Trigger

```bash
# Trigger cyclist-profile deployment
curl -X POST https://portainer.example.com/api/webhooks/xxx-xxx-xxx

# Trigger docs deployment
curl -X POST https://portainer.example.com/api/webhooks/yyy-yyy-yyy
```

---

## Environment Variables

### Required for All Services

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:password@atlas-postgres:5432/atlas
```

### Service-Specific

**Cyclist Profile:**
```env
PORT=3000
LOG_LEVEL=info
```

**Docs:**
```env
PORT=3001
```

### Database

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=atlas
```

---

## Troubleshooting

### Service Can't Connect to Database

**Problem**: `ECONNREFUSED` or `database "atlas" does not exist`

**Solutions**:
1. Check database is running: `docker ps | grep atlas-postgres`
2. Check network: Both services must be on `atlas-network`
3. Check DATABASE_URL uses correct hostname: `atlas-postgres` (not `localhost`)
4. Run migrations if database is empty

### Image Pull Failed

**Problem**: `unauthorized: authentication required`

**Solutions**:
1. Verify GitHub Container Registry is configured in Portainer
2. Check PAT has `read:packages` permission
3. Ensure repository packages are public or PAT has access

### Service Keeps Restarting

**Problem**: Container restarts immediately after starting

**Solutions**:
1. Check logs: `docker logs atlas-cyclist-profile`
2. Verify all environment variables are set
3. Check database is accessible
4. Verify migrations have been run

### Webhook Not Triggering

**Problem**: Webhook call succeeds but container doesn't update

**Solutions**:
1. Verify webhook URL is correct
2. Check Portainer has access to pull new image
3. Manually pull image: `docker pull ghcr.io/ameciclo/atlas/cyclist-profile:latest`
4. Check Portainer logs

---

## Best Practices

1. **Use Stacks**: Easier to manage related services
2. **Environment Variables**: Use Portainer's environment variable management
3. **Health Checks**: Always configure health checks
4. **Logging**: Use centralized logging (e.g., Loki, ELK)
5. **Backups**: Regular PostgreSQL backups
6. **Monitoring**: Set up monitoring (e.g., Prometheus, Grafana)
7. **Secrets**: Never commit secrets to git
8. **Rolling Updates**: Use webhooks for zero-downtime deployments

---

## Next Steps

1. Set up Portainer instance
2. Configure GitHub Container Registry
3. Deploy database stack
4. Run migrations
5. Deploy service stacks
6. Configure webhooks
7. Test deployment pipeline

For more details, see:
- [Portainer Documentation](https://docs.portainer.io/)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)

