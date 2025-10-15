# Deployment Checklist

Use this checklist to deploy Atlas services to Portainer.

## Pre-Deployment

### 1. Infrastructure Setup

- [ ] Portainer installed and accessible
- [ ] Docker network created: `docker network create atlas-network`
- [ ] GitHub Container Registry access configured
- [ ] SSL certificates configured (if using HTTPS)
- [ ] Firewall rules configured for required ports

### 2. Secrets and Environment Variables

- [ ] `POSTGRES_PASSWORD` generated (strong password)
- [ ] Database credentials documented securely
- [ ] GitHub secrets configured:
  - [ ] `PORTAINER_WEBHOOK_CYCLIST_PROFILE`
  - [ ] `PORTAINER_WEBHOOK_DOCS`
- [ ] Optional secrets configured (API keys, JWT secrets, etc.)

### 3. DNS and Networking

- [ ] Domain names configured (if applicable)
- [ ] DNS records pointing to server
- [ ] Reverse proxy configured (nginx, traefik, etc.)
- [ ] SSL/TLS certificates installed

## Database Deployment

### 1. Deploy Database Stack

- [ ] Open Portainer UI
- [ ] Navigate to **Stacks** → **Add stack**
- [ ] Name: `atlas-database`
- [ ] Copy content from `deployment/portainer/database-stack.yml`
- [ ] Set environment variables:
  - [ ] `POSTGRES_PASSWORD` (required)
  - [ ] `POSTGRES_USER` (optional, default: postgres)
  - [ ] `POSTGRES_DB` (optional, default: atlas)
- [ ] Click **Deploy the stack**

### 2. Verify Database

- [ ] Check stack status: Should be "Running"
- [ ] Check container logs: `docker logs atlas-postgres`
- [ ] Test connection:
  ```bash
  docker exec -it atlas-postgres psql -U postgres -d atlas
  ```
- [ ] Verify health check:
  ```bash
  docker exec atlas-postgres pg_isready -U postgres -d atlas
  ```

### 3. Initial Database Setup

- [ ] Run initial migrations (if needed):
  ```bash
  docker run --rm \
    --network atlas-network \
    -e DATABASE_URL=postgresql://postgres:PASSWORD@atlas-postgres:5432/atlas \
    ghcr.io/ameciclo/atlas/cyclist-profile:latest \
    node packages/database/dist/migrate.js
  ```
- [ ] Verify schemas created:
  ```sql
  \dn -- List schemas
  ```

## Service Deployment

### For Each Service (cyclist-profile, docs, etc.)

#### 1. Deploy Service Stack

- [ ] Open Portainer UI
- [ ] Navigate to **Stacks** → **Add stack**
- [ ] Name: `atlas-<service-name>`
- [ ] Copy content from `deployment/portainer/<service-name>-stack.yml`
- [ ] Set environment variables:
  - [ ] `POSTGRES_PASSWORD` (required for services with database)
  - [ ] `PORT` (optional, has defaults)
  - [ ] `LOG_LEVEL` (optional, default: info)
  - [ ] `IMAGE_TAG` (optional, default: latest)
- [ ] Click **Deploy the stack**

#### 2. Verify Service

- [ ] Check stack status: Should be "Running"
- [ ] Check container logs: `docker logs atlas-<service-name>`
- [ ] Test health endpoint:
  ```bash
  curl http://localhost:<PORT>/health
  ```
- [ ] Test API endpoints (if applicable)

#### 3. Enable Webhook

- [ ] Go to **Stacks** → `atlas-<service-name>`
- [ ] Click **Webhooks** tab
- [ ] Enable webhook
- [ ] Copy webhook URL
- [ ] Add to GitHub secrets as `PORTAINER_WEBHOOK_<SERVICE_NAME>`

## CI/CD Configuration

### 1. GitHub Secrets

Verify all secrets are configured in GitHub:

- [ ] Go to repository **Settings** → **Secrets and variables** → **Actions**
- [ ] Verify secrets exist:
  - [ ] `PORTAINER_WEBHOOK_CYCLIST_PROFILE`
  - [ ] `PORTAINER_WEBHOOK_DOCS`
  - [ ] Add more as services are added

### 2. Test Deployment Workflow

- [ ] Go to **Actions** tab in GitHub
- [ ] Select **Deploy to Production** workflow
- [ ] Click **Run workflow**
- [ ] Select environment: `production`
- [ ] Leave app empty (deploy all) or select specific app
- [ ] Click **Run workflow**
- [ ] Monitor workflow execution
- [ ] Verify services updated in Portainer

### 3. Test Automatic Deployment

- [ ] Make a small change to a service
- [ ] Commit and push to main branch
- [ ] Verify **Docker Build & Push** workflow runs
- [ ] Verify **Deploy to Production** workflow triggers
- [ ] Verify service updates in Portainer

## Post-Deployment

### 1. Monitoring Setup

- [ ] Configure health check monitoring
- [ ] Set up log aggregation (if applicable)
- [ ] Configure alerting (email, Slack, etc.)
- [ ] Set up uptime monitoring

### 2. Backup Configuration

- [ ] Configure automated database backups
- [ ] Test backup restoration process
- [ ] Document backup schedule
- [ ] Store backups securely (off-site)

### 3. Documentation

- [ ] Document deployed services and versions
- [ ] Document environment variables
- [ ] Document webhook URLs (securely)
- [ ] Update runbook with deployment procedures

### 4. Security Hardening

- [ ] Review exposed ports
- [ ] Configure firewall rules
- [ ] Enable fail2ban (if applicable)
- [ ] Review container security settings
- [ ] Scan images for vulnerabilities

### 5. Performance Tuning

- [ ] Review resource limits
- [ ] Adjust based on actual usage
- [ ] Configure database connection pooling
- [ ] Optimize database queries (if needed)

## Rollback Procedure

If deployment fails:

### Option 1: Via Portainer UI

- [ ] Go to **Stacks** → Select stack
- [ ] Click **Editor**
- [ ] Change `IMAGE_TAG` to previous version (e.g., `sha-abc123`)
- [ ] Click **Update the stack**

### Option 2: Via Git Revert

- [ ] Revert the problematic commit
- [ ] Push to main branch
- [ ] CI/CD will deploy the reverted version

### Option 3: Manual Rollback

- [ ] Pull previous image:
  ```bash
  docker pull ghcr.io/ameciclo/atlas/<service>:sha-<previous-commit>
  ```
- [ ] Update stack with previous image tag
- [ ] Restart service

## Troubleshooting

### Service Won't Start

- [ ] Check container logs: `docker logs atlas-<service-name>`
- [ ] Verify environment variables are set correctly
- [ ] Check database connectivity
- [ ] Verify network connectivity: `docker network inspect atlas-network`
- [ ] Check resource limits (CPU, memory)

### Database Connection Issues

- [ ] Verify database is running: `docker ps | grep atlas-postgres`
- [ ] Check database logs: `docker logs atlas-postgres`
- [ ] Test connection from service container:
  ```bash
  docker exec -it atlas-<service-name> sh
  nc -zv atlas-postgres 5432
  ```
- [ ] Verify `DATABASE_URL` is correct

### Webhook Not Triggering

- [ ] Verify webhook URL is correct in GitHub secrets
- [ ] Test webhook manually:
  ```bash
  curl -X POST "https://portainer.example.com/api/webhooks/..."
  ```
- [ ] Check Portainer logs: `docker logs portainer`
- [ ] Verify webhook is enabled in Portainer stack settings

### Migration Failures

- [ ] Check migration logs in init container
- [ ] Verify database schema exists
- [ ] Check for conflicting migrations
- [ ] Manually run migrations:
  ```bash
  docker run --rm \
    --network atlas-network \
    -e DATABASE_URL=postgresql://postgres:PASSWORD@atlas-postgres:5432/atlas \
    ghcr.io/ameciclo/atlas/<service>:latest \
    node packages/database/dist/migrate.js
  ```

## Maintenance

### Regular Tasks

#### Daily
- [ ] Check service health
- [ ] Review error logs
- [ ] Monitor resource usage

#### Weekly
- [ ] Review and rotate logs
- [ ] Check for security updates
- [ ] Review backup integrity

#### Monthly
- [ ] Update dependencies
- [ ] Review and optimize database
- [ ] Test disaster recovery procedures
- [ ] Review and update documentation

## Emergency Contacts

Document key contacts for emergencies:

- **DevOps Lead**: [Name, Contact]
- **Database Admin**: [Name, Contact]
- **On-Call Engineer**: [Rotation Schedule]
- **Hosting Provider Support**: [Contact Info]

## Additional Resources

- [DEPLOYMENT_STRATEGY.md](../DEPLOYMENT_STRATEGY.md) - Detailed deployment strategy
- [deployment/portainer/README.md](./portainer/README.md) - Portainer stack documentation
- [ARCHITECTURE_OVERVIEW.md](../ARCHITECTURE_OVERVIEW.md) - System architecture
- [DEVELOPMENT.md](../DEVELOPMENT.md) - Development guide

---

**Last Updated**: [Date]
**Deployed By**: [Name]
**Deployment Version**: [Version/Commit SHA]

