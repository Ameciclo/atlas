# Portainer Deployment

This directory contains Docker Compose stack templates for deploying Atlas services in Portainer.

## Available Stacks

### Production Stacks (Recommended)

- **`atlas-stack-kong.yml`** - Complete Atlas stack with Kong Gateway
  - Includes: Database, Cyclist Profile API, Docs, Kong Gateway
  - Best for: Production deployments with API gateway
  - Network: Uses external `kong-gateway_kong-net` network

### Individual Service Stacks

- **`database-stack.yml`** - PostgreSQL with PostGIS
- **`cyclist-profile-stack.yml`** - Cyclist Profile API service
- **`docs-stack.yml`** - API documentation site

### Alternative Configurations

- **`atlas-stack.yml`** - Basic stack without Kong
- **`atlas-stack-managed-db.yml`** - Stack using external managed database

## Quick Start

### 1. Prerequisites

- Portainer installed and accessible
- Kong Gateway network created (for Kong stack): `docker network create kong-gateway_kong-net`
- GitHub Container Registry access configured

### 2. Deploy the Stack

**Option A: Full Stack with Kong (Recommended)**

1. In Portainer: **Stacks** → **Add stack**
2. Name: `atlas`
3. Build method: **Web editor**
4. Paste content from `atlas-stack-kong.yml`
5. Set environment variables (see below)
6. Deploy

**Option B: Individual Services**

Deploy in this order:
1. Database (`database-stack.yml`)
2. Services (`cyclist-profile-stack.yml`, `docs-stack.yml`)

### 3. Environment Variables

**Required:**
- `POSTGRES_PASSWORD` - Database password (use Portainer secrets)

**Optional:**
- `PORT` - Service port (defaults: cyclist-profile=3000)
- `LOG_LEVEL` - Logging level (default: info)
- `NODE_ENV` - Environment (default: production)

### 4. Configure CI/CD Webhooks

Enable webhooks for automatic deployments:

1. Go to **Stacks** → Select stack → **Webhooks**
2. Enable webhook and copy URL
3. Add to GitHub repository secrets:
   - `PORTAINER_WEBHOOK_CYCLIST_PROFILE`
   - `PORTAINER_WEBHOOK_DOCS`

## Stack Architecture

### atlas-stack-kong.yml

**Services:**
- `postgres` - PostgreSQL 16 with PostGIS 3.5
- `cyclist-profile` - Cyclist Profile API (Node.js)
- `docs` - API Documentation (Nginx static site)
- Kong Gateway integration via external network

**Features:**
- Automatic database migrations
- Health checks for all services
- Persistent database volumes
- Production-ready configuration

**Network:**
- Uses external `kong-gateway_kong-net` network
- Services accessible via Kong routes:
  - Cyclist Profile: `/cyclist-profile/*`
  - Docs: `/docs/*`

### Individual Stacks

**database-stack.yml:**
- PostgreSQL with PostGIS extension
- Persistent volumes
- Health checks

**cyclist-profile-stack.yml:**
- Cyclist Profile API service
- Automatic migrations on startup
- Configurable port (default: 3000)

**docs-stack.yml:**
- Static documentation site (Nginx)
- Displays OpenAPI specs from all services
- No database dependency
- Runs on port 80 (internal)

## Deployment Methods

### Automatic (CI/CD)

GitHub Actions automatically deploys when code is pushed to `main`:

1. Code pushed → Docker images built
2. Images pushed to GitHub Container Registry
3. Webhook triggered → Portainer pulls new images
4. Services automatically redeployed

**Setup:** Configure webhooks (see step 4 in Quick Start)

### Manual (Portainer UI)

1. **Stacks** → Select stack → **Editor**
2. Click **Pull and redeploy** to get latest images
3. Or edit stack configuration and click **Update**

### Manual (Webhook)

Trigger deployment via webhook:

```bash
curl -X POST "https://portainer.example.com/api/webhooks/your-webhook-id"
```

## Troubleshooting

### Service Won't Start

**Check logs:**
```bash
docker logs atlas-cyclist-profile
docker logs atlas-docs
```

**Common issues:**
- Database not ready → Wait for postgres health check to pass
- Missing environment variables → Check Portainer stack env vars
- Network not found → Ensure `kong-gateway_kong-net` exists

### Database Connection Failed

**Check database:**
```bash
docker exec -it atlas-postgres psql -U postgres -d atlas
```

**Verify connection:**
```bash
docker exec atlas-postgres pg_isready -U postgres -d atlas
```

### Docs Show "No OpenAPI Specs Found"

This issue has been fixed in the CI/CD pipeline. If you still see it:

1. Check that the docs image is up to date: `docker pull ghcr.io/ameciclo/atlas/docs:latest`
2. Verify OpenAPI specs exist in the image: `docker exec atlas-docs ls -la /usr/share/nginx/html/openapi/`
3. Redeploy the stack to pull the latest image

### Webhook Not Working

**Test webhook:**
```bash
curl -v -X POST "https://portainer.example.com/api/webhooks/your-webhook-id"
```

**Check GitHub Actions logs** for deployment workflow errors

## Monitoring

### Health Checks

All services have health checks configured:

- **Cyclist Profile:** `GET /health` (port 3000)
- **Docs:** `wget http://127.0.0.1/` (port 80)
- **Database:** `pg_isready -U postgres`

**View health status:**
```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

### Container Stats

```bash
docker stats atlas-cyclist-profile atlas-docs atlas-postgres
```

## Database Management

### Migrations

Migrations run automatically on service startup. No manual intervention needed.

**Manual migration (if needed):**
```bash
docker exec atlas-cyclist-profile pnpm --filter @atlas/database db:migrate
```

### Backups

**Backup database:**
```bash
docker exec atlas-postgres pg_dump -U postgres atlas > backup-$(date +%Y%m%d).sql
```

**Restore database:**
```bash
docker exec -i atlas-postgres psql -U postgres atlas < backup-20250116.sql
```

## Best Practices

1. ✅ **Use Portainer secrets** for `POSTGRES_PASSWORD`
2. ✅ **Monitor health checks** to ensure services are running
3. ✅ **Backup database regularly** (automated backups recommended)
4. ✅ **Use CI/CD webhooks** for automatic deployments
5. ✅ **Test in staging** before deploying to production
6. ✅ **Review logs** after deployments

## Related Documentation

- **[OpenAPI Workflow](../../docs/OPENAPI_WORKFLOW.md)** - How OpenAPI specs are generated
- **[Create New Service](../../docs/CREATE_NEW_SERVICE.md)** - Adding new services to Atlas
- **GitHub Actions Workflows** - See `.github/workflows/` for CI/CD configuration

