# Deployment Strategy with Portainer

This document outlines the deployment strategy for Atlas services using Portainer with webhook-based deployments.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Docker Images](#docker-images)
3. [Portainer Setup](#portainer-setup)
4. [Database Deployment](#database-deployment)
5. [Service Deployment](#service-deployment)
6. [Webhook Deployment](#webhook-deployment)
7. [CI/CD Integration](#cicd-integration)

---

## Architecture Overview

### Deployment Model

```
GitHub Actions (CI/CD)
    ↓
Build Docker Images (per service)
    ↓
Push to GitHub Container Registry (GHCR)
    ↓
Trigger Portainer Webhooks
    ↓
Portainer pulls new images
    ↓
Services restart with new images
```

### Components

1. **Database**: Single PostgreSQL instance (shared)
2. **Services**: Multiple containers (cyclist-profile, docs, etc.)
3. **Migrations**: Run before service deployment
4. **Networking**: Docker network for inter-service communication

---

## Docker Images

### Image Naming Convention

```
ghcr.io/ameciclo/atlas/<service-name>:<tag>
```

**Examples:**
- `ghcr.io/ameciclo/atlas/cyclist-profile:latest`
- `ghcr.io/ameciclo/atlas/cyclist-profile:sha-abc123`
- `ghcr.io/ameciclo/atlas/docs:latest`

### Image Tags

- `latest` - Latest stable version from main branch
- `sha-<commit>` - Specific commit SHA
- `<branch-name>` - Branch-specific builds

### Current Images

Based on your apps with Dockerfiles:
- `cyclist-profile` - API service
- `docs` - Documentation site

---

## Portainer Setup

### 1. Create Docker Network

First, create a shared network for all Atlas services:

```bash
docker network create atlas-network
```

### 2. Deploy Database

Create a Portainer stack called `atlas-database`:

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
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - atlas-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d atlas"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
    name: atlas-postgres-data

networks:
  atlas-network:
    external: true
```

**Environment Variables in Portainer:**
- `POSTGRES_PASSWORD` - Set this as a secret

### 3. Deploy Services

Each service gets its own Portainer stack.

---

## Database Deployment

### Migration Strategy

**Option 1: Init Container (Recommended)**

Run migrations as an init container before the service starts:

```yaml
services:
  migrate:
    image: ghcr.io/ameciclo/atlas/cyclist-profile:latest
    command: node packages/database/dist/migrate.js
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@atlas-postgres:5432/atlas
    networks:
      - atlas-network
    depends_on:
      postgres:
        condition: service_healthy
    restart: "no"

  app:
    image: ghcr.io/ameciclo/atlas/cyclist-profile:latest
    depends_on:
      migrate:
        condition: service_completed_successfully
    # ... rest of config
```

**Option 2: Separate Migration Job**

Run migrations manually or via webhook before deploying services.

**Option 3: Startup Script**

Run migrations in the service startup (not recommended for production).

---

## Service Deployment

### Cyclist Profile Service Stack

Create a Portainer stack called `atlas-cyclist-profile`:

```yaml
version: '3.8'

services:
  migrate:
    image: ghcr.io/ameciclo/atlas/cyclist-profile:latest
    command: node packages/database/dist/migrate.js
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@atlas-postgres:5432/atlas
      NODE_ENV: production
    networks:
      - atlas-network
    restart: "no"

  app:
    image: ghcr.io/ameciclo/atlas/cyclist-profile:latest
    container_name: atlas-cyclist-profile
    ports:
      - "${PORT:-3000}:3000"
    environment:
      NODE_ENV: production
      LOG_LEVEL: ${LOG_LEVEL:-info}
      PORT: 3000
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@atlas-postgres:5432/atlas
    networks:
      - atlas-network
    depends_on:
      migrate:
        condition: service_completed_successfully
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"]
      interval: 30s
      timeout: 10s
      start_period: 40s
      retries: 3

networks:
  atlas-network:
    external: true
```

**Environment Variables in Portainer:**
- `POSTGRES_PASSWORD` - Database password (secret)
- `PORT` - Service port (default: 3000)
- `LOG_LEVEL` - Logging level (default: info)

### Docs Service Stack

Create a Portainer stack called `atlas-docs`:

```yaml
version: '3.8'

services:
  app:
    image: ghcr.io/ameciclo/atlas/docs:latest
    container_name: atlas-docs
    ports:
      - "${PORT:-3001}:3001"
    environment:
      NODE_ENV: production
      LOG_LEVEL: ${LOG_LEVEL:-info}
      PORT: 3001
    networks:
      - atlas-network
    restart: unless-stopped

networks:
  atlas-network:
    external: true
```

---

## Webhook Deployment

### 1. Enable Webhooks in Portainer

For each stack:

1. Go to **Stacks** → Select your stack
2. Click **Webhooks** tab
3. Enable webhook
4. Copy the webhook URL

**Example webhook URL:**
```
https://portainer.example.com/api/webhooks/abc123-def456-ghi789
```

### 2. Store Webhooks as GitHub Secrets

Add these secrets to your GitHub repository:

- `PORTAINER_WEBHOOK_CYCLIST_PROFILE`
- `PORTAINER_WEBHOOK_DOCS`
- `PORTAINER_WEBHOOK_DATABASE` (optional, for migration-only deployments)

### 3. Webhook Behavior

When triggered, Portainer will:
1. Pull the latest image with the specified tag
2. Stop the current container
3. Start a new container with the new image
4. Preserve environment variables and volumes

**Important:** Webhooks pull the `:latest` tag by default. To use specific tags, configure the stack accordingly.

---

## CI/CD Integration

### Updated GitHub Actions Workflow

Update `.github/workflows/deploy.yml` to use webhooks:

```yaml
name: Deploy to Production

on:
  workflow_run:
    workflows: ["Docker Build & Push"]
    types:
      - completed
    branches:
      - main
  workflow_dispatch:
    inputs:
      app:
        description: 'App to deploy (leave empty for all)'
        required: false
        type: string

permissions:
  contents: read

jobs:
  deploy:
    name: Deploy via Portainer Webhook
    runs-on: ubuntu-latest
    if: |
      github.event_name == 'workflow_dispatch' ||
      (github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'success')
    strategy:
      matrix:
        include:
          - app: cyclist-profile
            webhook_secret: PORTAINER_WEBHOOK_CYCLIST_PROFILE
          - app: docs
            webhook_secret: PORTAINER_WEBHOOK_DOCS
    steps:
      - name: Trigger Portainer Webhook
        if: |
          github.event.inputs.app == '' ||
          github.event.inputs.app == matrix.app
        run: |
          WEBHOOK_URL="${{ secrets[matrix.webhook_secret] }}"
          
          if [ -z "$WEBHOOK_URL" ]; then
            echo "Warning: Webhook URL not configured for ${{ matrix.app }}"
            exit 0
          fi
          
          echo "Triggering deployment for ${{ matrix.app }}..."
          
          RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$WEBHOOK_URL")
          HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
          BODY=$(echo "$RESPONSE" | head -n-1)
          
          if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 204 ]; then
            echo "✅ Successfully triggered deployment for ${{ matrix.app }}"
          else
            echo "❌ Failed to trigger deployment for ${{ matrix.app }}"
            echo "HTTP Code: $HTTP_CODE"
            echo "Response: $BODY"
            exit 1
          fi

      - name: Wait for deployment
        if: |
          github.event.inputs.app == '' ||
          github.event.inputs.app == matrix.app
        run: |
          echo "Waiting 30 seconds for deployment to complete..."
          sleep 30

      - name: Verify deployment
        if: |
          github.event.inputs.app == '' ||
          github.event.inputs.app == matrix.app
        run: |
          echo "Deployment triggered for ${{ matrix.app }}"
          echo "Check Portainer UI for deployment status"
```

---

## Deployment Workflow

### Automatic Deployment (Main Branch)

```
1. Developer pushes to main
2. CI runs tests and builds
3. Docker images built and pushed to GHCR
4. Deploy workflow triggers
5. Portainer webhooks called
6. Services update automatically
```

### Manual Deployment

```
1. Go to GitHub Actions
2. Select "Deploy to Production" workflow
3. Click "Run workflow"
4. Select app to deploy (or leave empty for all)
5. Click "Run workflow"
```

### Rollback

To rollback to a previous version:

**Option 1: Via Portainer UI**
1. Go to stack
2. Edit stack
3. Change image tag to previous SHA
4. Update stack

**Option 2: Via Git**
1. Revert the commit
2. Push to main
3. CI/CD will deploy the reverted version

---

## Best Practices

### 1. Use Specific Tags for Production

Instead of `:latest`, use SHA tags for production:

```yaml
image: ghcr.io/ameciclo/atlas/cyclist-profile:sha-abc123
```

### 2. Run Migrations Separately

For critical deployments, run migrations manually before updating services.

### 3. Health Checks

Always configure health checks to ensure services are running correctly.

### 4. Monitoring

Set up monitoring for:
- Container health
- Database connections
- API response times
- Error rates

### 5. Secrets Management

Use Portainer's secrets or environment variables for sensitive data:
- Database passwords
- API keys
- JWT secrets

### 6. Backup Strategy

Regular backups of:
- PostgreSQL database
- Portainer configuration
- Docker volumes

---

## Next Steps

1. **Set up Portainer stacks** for each service
2. **Configure webhooks** in Portainer
3. **Add webhook URLs** to GitHub secrets
4. **Update deploy.yml** with webhook integration
5. **Test deployment** with a non-critical service
6. **Document service-specific** environment variables
7. **Set up monitoring** and alerting

---

For more information, see:
- [Portainer Webhooks Documentation](https://docs.portainer.io/user/docker/stacks/webhooks)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)

