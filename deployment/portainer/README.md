# Portainer Stack Templates

This directory contains Docker Compose stack templates for deploying Atlas services in Portainer.

## Quick Start

### 1. Prerequisites

- Portainer installed and accessible
- Docker network created: `docker network create atlas-network`
- GitHub Container Registry access configured

### 2. Deployment Order

Deploy stacks in this order:

1. **Database** (`database-stack.yml`) - PostgreSQL with PostGIS
2. **Services** - Deploy each service stack
   - `cyclist-profile-stack.yml`
   - `docs-stack.yml`

### 3. Environment Variables

Each stack requires environment variables. Set these in Portainer:

**Database Stack:**
- `POSTGRES_PASSWORD` - Database password (required, secret)

**Service Stacks:**
- `POSTGRES_PASSWORD` - Database password (required, secret)
- `PORT` - Service port (optional, has defaults)
- `LOG_LEVEL` - Logging level (optional, default: info)

### 4. Enable Webhooks

For each service stack:

1. Go to **Stacks** → Select stack
2. Click **Webhooks** tab
3. Enable webhook
4. Copy webhook URL
5. Add to GitHub secrets as `PORTAINER_WEBHOOK_<SERVICE_NAME>`

## Stack Files

### database-stack.yml

Shared PostgreSQL database for all services.

**Features:**
- PostGIS extension
- Health checks
- Persistent volumes
- Automatic restarts

### cyclist-profile-stack.yml

Cyclist Profile API service.

**Features:**
- Automatic migrations on startup
- Health checks
- Configurable port
- Connected to shared database

### docs-stack.yml

API documentation site.

**Features:**
- Serves OpenAPI specs
- No database dependency
- Configurable port

## Webhook URLs

After enabling webhooks, you'll get URLs like:

```
https://portainer.example.com/api/webhooks/abc123-def456-ghi789
```

Add these to GitHub repository secrets:

```bash
# In GitHub repository settings → Secrets and variables → Actions

PORTAINER_WEBHOOK_CYCLIST_PROFILE=https://portainer.example.com/api/webhooks/...
PORTAINER_WEBHOOK_DOCS=https://portainer.example.com/api/webhooks/...
```

## Manual Deployment

### Via Portainer UI

1. Go to **Stacks** → **Add stack**
2. Name: `atlas-<service-name>`
3. Build method: **Web editor**
4. Paste stack content
5. Add environment variables
6. Deploy

### Via Portainer API

```bash
# Get auth token
TOKEN=$(curl -s -X POST "https://portainer.example.com/api/auth" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}' | jq -r .jwt)

# Create stack
curl -X POST "https://portainer.example.com/api/stacks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @create-stack-payload.json
```

## Updating Stacks

### Via Webhook (Recommended)

```bash
curl -X POST "https://portainer.example.com/api/webhooks/your-webhook-id"
```

### Via Portainer UI

1. Go to **Stacks** → Select stack
2. Click **Editor**
3. Make changes
4. Click **Update the stack**

### Via Git Sync (Advanced)

Configure Portainer to sync stacks from a Git repository.

## Troubleshooting

### Service won't start

**Check logs:**
```bash
docker logs atlas-cyclist-profile
```

**Common issues:**
- Database not ready → Check postgres health
- Missing environment variables → Check Portainer env vars
- Port already in use → Change PORT env var

### Database connection failed

**Check database:**
```bash
docker exec -it atlas-postgres psql -U postgres -d atlas
```

**Verify network:**
```bash
docker network inspect atlas-network
```

### Webhook not working

**Test webhook manually:**
```bash
curl -v -X POST "https://portainer.example.com/api/webhooks/your-webhook-id"
```

**Check Portainer logs:**
```bash
docker logs portainer
```

## Best Practices

1. **Use secrets** for sensitive data (passwords, API keys)
2. **Tag images** with SHA instead of `latest` for production
3. **Test in staging** before deploying to production
4. **Monitor health checks** to ensure services are running
5. **Backup database** regularly
6. **Document changes** to stack configurations

## Migration Strategy

### Running Migrations

Migrations run automatically via init container in each service stack.

**Manual migration:**
```bash
docker run --rm \
  --network atlas-network \
  -e DATABASE_URL=postgresql://postgres:password@atlas-postgres:5432/atlas \
  ghcr.io/ameciclo/atlas/cyclist-profile:latest \
  node packages/database/dist/migrate.js
```

### Migration Rollback

If a migration fails:

1. Fix the migration in code
2. Push to GitHub
3. CI/CD will build new image
4. Redeploy via webhook

## Monitoring

### Health Check Endpoints

- Cyclist Profile: `http://localhost:3000/health`
- Docs: `http://localhost:3001/health` (if implemented)

### Database Health

```bash
docker exec atlas-postgres pg_isready -U postgres -d atlas
```

### Container Stats

```bash
docker stats atlas-cyclist-profile atlas-docs atlas-postgres
```

## Scaling

### Horizontal Scaling

To run multiple instances of a service:

1. Use a load balancer (nginx, traefik)
2. Update stack to use replicas
3. Ensure services are stateless

**Example:**
```yaml
services:
  app:
    image: ghcr.io/ameciclo/atlas/cyclist-profile:latest
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
```

### Vertical Scaling

Increase resources for containers:

```yaml
services:
  app:
    image: ghcr.io/ameciclo/atlas/cyclist-profile:latest
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

## Security

### Network Isolation

Services communicate via `atlas-network`. External access only through exposed ports.

### Secrets Management

Use Portainer secrets for sensitive data:

```yaml
services:
  app:
    secrets:
      - postgres_password
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@atlas-postgres:5432/atlas

secrets:
  postgres_password:
    external: true
```

### Image Security

- Images are scanned in CI/CD
- Use specific tags (SHA) for production
- Regularly update base images

## Backup and Recovery

### Database Backup

```bash
# Backup
docker exec atlas-postgres pg_dump -U postgres atlas > backup.sql

# Restore
docker exec -i atlas-postgres psql -U postgres atlas < backup.sql
```

### Volume Backup

```bash
# Backup volume
docker run --rm \
  -v atlas-postgres-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/postgres-data-backup.tar.gz /data

# Restore volume
docker run --rm \
  -v atlas-postgres-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/postgres-data-backup.tar.gz -C /
```

## Support

For issues or questions:
- Check [DEPLOYMENT_STRATEGY.md](../../DEPLOYMENT_STRATEGY.md)
- Review [ARCHITECTURE_OVERVIEW.md](../../ARCHITECTURE_OVERVIEW.md)
- Open an issue on GitHub

