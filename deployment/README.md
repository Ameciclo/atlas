# Atlas Deployment Guide

Complete deployment documentation for Atlas services using Portainer.

## Overview

Atlas uses a **webhook-based deployment strategy** with Portainer for container orchestration. Each service is built as a separate Docker image, pushed to GitHub Container Registry (GHCR), and deployed via Portainer webhooks.

## Architecture

```
GitHub → CI/CD → GHCR → Portainer Webhooks → Docker Containers
```

### Key Components

1. **GitHub Actions**: Builds and tests code, creates Docker images
2. **GHCR**: Stores Docker images
3. **Portainer**: Manages Docker stacks and containers
4. **Webhooks**: Trigger automatic deployments
5. **Docker Network**: Connects all services

## Quick Start

### 1. Prerequisites

- Portainer installed and accessible
- Docker network: `docker network create atlas-network`
- GitHub Container Registry access configured

### 2. Deploy Database

```bash
# In Portainer UI:
# 1. Stacks → Add stack → Name: atlas-database
# 2. Copy content from deployment/portainer/database-stack.yml
# 3. Set POSTGRES_PASSWORD
# 4. Deploy
```

### 3. Deploy Services

For each service (cyclist-profile, docs):

```bash
# In Portainer UI:
# 1. Stacks → Add stack → Name: atlas-<service-name>
# 2. Copy content from deployment/portainer/<service-name>-stack.yml
# 3. Set environment variables
# 4. Deploy
# 5. Enable webhook
# 6. Copy webhook URL to GitHub secrets
```

### 4. Configure CI/CD

Add webhook URLs to GitHub repository secrets:

```
PORTAINER_WEBHOOK_CYCLIST_PROFILE=https://portainer.example.com/api/webhooks/...
PORTAINER_WEBHOOK_DOCS=https://portainer.example.com/api/webhooks/...
```

### 5. Test Deployment

```bash
# Push to main branch or manually trigger workflow
# GitHub Actions → Deploy to Production → Run workflow
```

## Documentation

### Core Documents

- **[DEPLOYMENT_STRATEGY.md](../DEPLOYMENT_STRATEGY.md)** - Comprehensive deployment strategy
  - Architecture overview
  - Docker images and naming
  - Portainer setup
  - Database deployment
  - Service deployment
  - Webhook configuration
  - CI/CD integration
  - Best practices

- **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** - Step-by-step deployment checklist
  - Pre-deployment tasks
  - Database deployment
  - Service deployment
  - CI/CD configuration
  - Post-deployment verification
  - Troubleshooting guide
  - Maintenance tasks

- **[portainer/README.md](./portainer/README.md)** - Portainer stack documentation
  - Stack templates
  - Environment variables
  - Webhook setup
  - Manual deployment
  - Troubleshooting
  - Monitoring
  - Scaling
  - Security
  - Backup and recovery

### Stack Templates

- **[portainer/database-stack.yml](./portainer/database-stack.yml)** - PostgreSQL database
- **[portainer/cyclist-profile-stack.yml](./portainer/cyclist-profile-stack.yml)** - Cyclist Profile API
- **[portainer/docs-stack.yml](./portainer/docs-stack.yml)** - Documentation site

## Deployment Workflow

### Automatic Deployment (Main Branch)

```
1. Developer pushes to main
   ↓
2. CI runs tests and builds
   ↓
3. Docker images built and pushed to GHCR
   ↓
4. Deploy workflow triggers
   ↓
5. Portainer webhooks called
   ↓
6. Services update automatically
```

### Manual Deployment

```
1. Go to GitHub Actions
   ↓
2. Select "Deploy to Production" workflow
   ↓
3. Click "Run workflow"
   ↓
4. Select app to deploy (or leave empty for all)
   ↓
5. Select environment (production/staging)
   ↓
6. Click "Run workflow"
```

## Service Architecture

### Database Stack

- **Service**: PostgreSQL 16 with PostGIS
- **Container**: `atlas-postgres`
- **Network**: `atlas-network`
- **Volume**: `atlas-postgres-data`
- **Port**: 5432 (optional external access)

### Cyclist Profile Stack

- **Migration**: Init container runs migrations
- **Service**: Cyclist Profile API
- **Container**: `atlas-cyclist-profile`
- **Network**: `atlas-network`
- **Port**: 3000 (configurable)
- **Dependencies**: Database

### Docs Stack

- **Service**: API Documentation
- **Container**: `atlas-docs`
- **Network**: `atlas-network`
- **Port**: 3001 (configurable)
- **Dependencies**: None

## Environment Variables

### Database Stack

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_PASSWORD` | Yes | - | Database password |
| `POSTGRES_USER` | No | postgres | Database user |
| `POSTGRES_DB` | No | atlas | Database name |

### Service Stacks

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_PASSWORD` | Yes* | - | Database password |
| `PORT` | No | 3000/3001 | Service port |
| `LOG_LEVEL` | No | info | Logging level |
| `IMAGE_TAG` | No | latest | Docker image tag |

*Required only for services with database access

## Webhooks

### How Webhooks Work

1. GitHub Actions completes Docker build
2. Deploy workflow triggers
3. Webhook URL is called via HTTP POST
4. Portainer receives webhook
5. Portainer pulls latest image from GHCR
6. Portainer stops current container
7. Portainer starts new container with new image

### Webhook Configuration

**In Portainer:**
1. Go to Stacks → Select stack
2. Click Webhooks tab
3. Enable webhook
4. Copy webhook URL

**In GitHub:**
1. Go to Settings → Secrets and variables → Actions
2. Add new secret: `PORTAINER_WEBHOOK_<SERVICE_NAME>`
3. Paste webhook URL

### Testing Webhooks

```bash
# Manual webhook trigger
curl -X POST "https://portainer.example.com/api/webhooks/your-webhook-id"

# Check response
# 200/204 = Success
# 404 = Webhook not found
# 500 = Server error
```

## Monitoring

### Health Checks

Each service has health check endpoints:

```bash
# Cyclist Profile
curl http://localhost:3000/health

# Docs
curl http://localhost:3001/

# Database
docker exec atlas-postgres pg_isready -U postgres -d atlas
```

### Container Logs

```bash
# View logs
docker logs atlas-cyclist-profile
docker logs atlas-docs
docker logs atlas-postgres

# Follow logs
docker logs -f atlas-cyclist-profile

# Last 100 lines
docker logs --tail 100 atlas-cyclist-profile
```

### Container Stats

```bash
# Real-time stats
docker stats atlas-cyclist-profile atlas-docs atlas-postgres

# One-time stats
docker stats --no-stream
```

## Troubleshooting

### Common Issues

**Service won't start**
- Check logs: `docker logs atlas-<service-name>`
- Verify environment variables
- Check database connectivity
- Verify network: `docker network inspect atlas-network`

**Database connection failed**
- Check database is running: `docker ps | grep atlas-postgres`
- Test connection: `docker exec -it atlas-postgres psql -U postgres -d atlas`
- Verify `DATABASE_URL` is correct

**Webhook not working**
- Test manually: `curl -X POST "webhook-url"`
- Check Portainer logs: `docker logs portainer`
- Verify webhook is enabled in stack settings

**Migration failed**
- Check migration logs in init container
- Manually run migrations (see DEPLOYMENT_CHECKLIST.md)
- Verify database schema exists

## Rollback

### Via Portainer UI

1. Go to Stacks → Select stack
2. Click Editor
3. Change `IMAGE_TAG` to previous SHA
4. Click Update the stack

### Via Git Revert

1. Revert the problematic commit
2. Push to main branch
3. CI/CD will deploy the reverted version

## Security

### Best Practices

1. **Use secrets** for sensitive data (passwords, API keys)
2. **Tag images** with SHA instead of `latest` for production
3. **Limit exposed ports** to only what's necessary
4. **Use SSL/TLS** for all external communication
5. **Regular updates** of base images and dependencies
6. **Scan images** for vulnerabilities in CI/CD

### Network Security

- Services communicate via `atlas-network` (internal)
- External access only through exposed ports
- Use reverse proxy (nginx, traefik) for SSL termination
- Configure firewall rules appropriately

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
# Backup
docker run --rm \
  -v atlas-postgres-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/postgres-data-backup.tar.gz /data

# Restore
docker run --rm \
  -v atlas-postgres-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/postgres-data-backup.tar.gz -C /
```

## Scaling

### Horizontal Scaling

Use Docker Swarm or Kubernetes for multi-instance deployments:

```yaml
deploy:
  replicas: 3
  update_config:
    parallelism: 1
    delay: 10s
```

### Vertical Scaling

Adjust resource limits in stack files:

```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
```

## Support

### Resources

- [Portainer Documentation](https://docs.portainer.io/)
- [Docker Documentation](https://docs.docker.com/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

### Getting Help

- Check documentation in this directory
- Review [ARCHITECTURE_OVERVIEW.md](../ARCHITECTURE_OVERVIEW.md)
- Open an issue on GitHub
- Contact DevOps team

---

**For detailed step-by-step instructions, see [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)**

