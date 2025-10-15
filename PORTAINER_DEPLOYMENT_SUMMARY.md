# Portainer Deployment Strategy - Complete Summary

## 🎯 Overview

I've created a **complete webhook-based deployment strategy** for your Atlas monorepo using Portainer. Each service is built as a separate Docker image and deployed independently via Portainer webhooks.

## 📦 What Was Created

### 1. Documentation (7 files)

#### Core Strategy Documents
- **`DEPLOYMENT_STRATEGY.md`** (300 lines)
  - Complete deployment architecture
  - Docker image naming and tagging
  - Portainer setup guide
  - Database and service deployment
  - Webhook configuration
  - CI/CD integration
  - Best practices

#### Deployment Guides
- **`deployment/README.md`** (300 lines)
  - Quick start guide
  - Architecture overview
  - Deployment workflow
  - Environment variables reference
  - Monitoring and troubleshooting
  - Security and backup

- **`deployment/DEPLOYMENT_CHECKLIST.md`** (300 lines)
  - Step-by-step deployment checklist
  - Pre-deployment tasks
  - Database deployment
  - Service deployment
  - Post-deployment verification
  - Troubleshooting guide
  - Maintenance schedule

- **`deployment/portainer/README.md`** (300 lines)
  - Portainer stack templates guide
  - Webhook setup instructions
  - Manual deployment procedures
  - Troubleshooting
  - Monitoring and scaling
  - Security and backup

### 2. Portainer Stack Templates (3 files)

- **`deployment/portainer/database-stack.yml`**
  - PostgreSQL 16 with PostGIS
  - Health checks
  - Persistent volumes
  - Resource limits
  - Logging configuration

- **`deployment/portainer/cyclist-profile-stack.yml`**
  - Automatic migrations (init container)
  - Cyclist Profile API service
  - Health checks
  - Database connectivity
  - Resource limits

- **`deployment/portainer/docs-stack.yml`**
  - Documentation site
  - Health checks
  - Resource limits
  - No database dependency

### 3. Updated CI/CD Workflow

- **`.github/workflows/deploy.yml`** (updated)
  - Webhook-based deployment
  - Matrix strategy for multiple services
  - Automatic deployment after Docker build
  - Manual deployment option
  - Environment selection (production/staging)
  - Deployment verification

---

## 🏗️ Architecture

### Deployment Flow

```
Developer Push → GitHub Actions → Build & Test → Docker Build → Push to GHCR
                                                                      ↓
                                                              Deploy Workflow
                                                                      ↓
                                                          Trigger Webhooks
                                                                      ↓
                                                    Portainer pulls new images
                                                                      ↓
                                                      Services restart automatically
```

### Service Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Portainer Server                      │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │         Docker Network: atlas-network          │    │
│  │                                                 │    │
│  │  ┌──────────────┐  ┌──────────────────────┐  │    │
│  │  │   Database   │  │  Cyclist Profile     │  │    │
│  │  │   Stack      │  │  Stack               │  │    │
│  │  │              │  │                      │  │    │
│  │  │  PostgreSQL  │◄─┤  Migration (init)   │  │    │
│  │  │  PostGIS     │  │  API Service        │  │    │
│  │  └──────────────┘  └──────────────────────┘  │    │
│  │                                                 │    │
│  │  ┌──────────────┐                             │    │
│  │  │   Docs       │                             │    │
│  │  │   Stack      │                             │    │
│  │  │              │                             │    │
│  │  │  Docs Site   │                             │    │
│  │  └──────────────┘                             │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  Webhooks:                                              │
│  • cyclist-profile → PORTAINER_WEBHOOK_CYCLIST_PROFILE │
│  • docs → PORTAINER_WEBHOOK_DOCS                       │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 How It Works

### 1. Build Phase (GitHub Actions)

When you push to main:

1. **CI Workflow** runs tests and builds TypeScript
2. **OpenAPI Generation** creates API specs with database
3. **Docker Build** creates images for changed apps
4. **Push to GHCR** stores images at `ghcr.io/ameciclo/atlas/<service>:latest`

### 2. Deploy Phase (Automatic)

After successful Docker build:

1. **Deploy Workflow** triggers automatically
2. **Matrix Strategy** runs deployment for each service
3. **Webhook Call** sends HTTP POST to Portainer
4. **Portainer** pulls new image from GHCR
5. **Service Restart** with new image

### 3. Migration Handling

For services with database:

1. **Init Container** runs migrations first
2. **Main Service** starts only after migrations succeed
3. **Health Check** verifies service is running

---

## 📋 Deployment Steps

### Initial Setup (One-time)

#### 1. Create Docker Network
```bash
docker network create atlas-network
```

#### 2. Deploy Database Stack

In Portainer:
1. **Stacks** → **Add stack**
2. Name: `atlas-database`
3. Copy content from `deployment/portainer/database-stack.yml`
4. Set `POSTGRES_PASSWORD` environment variable
5. **Deploy the stack**

#### 3. Deploy Service Stacks

For each service (cyclist-profile, docs):

In Portainer:
1. **Stacks** → **Add stack**
2. Name: `atlas-<service-name>`
3. Copy content from `deployment/portainer/<service-name>-stack.yml`
4. Set environment variables (POSTGRES_PASSWORD, etc.)
5. **Deploy the stack**

#### 4. Enable Webhooks

For each service stack:
1. Go to **Stacks** → Select stack
2. Click **Webhooks** tab
3. **Enable webhook**
4. **Copy webhook URL**

#### 5. Configure GitHub Secrets

In GitHub repository:
1. **Settings** → **Secrets and variables** → **Actions**
2. Add secrets:
   - `PORTAINER_WEBHOOK_CYCLIST_PROFILE` = webhook URL
   - `PORTAINER_WEBHOOK_DOCS` = webhook URL

### Ongoing Deployments (Automatic)

Just push to main branch:

```bash
git push origin main
```

GitHub Actions will:
1. Build and test
2. Create Docker images
3. Push to GHCR
4. Trigger Portainer webhooks
5. Services update automatically

### Manual Deployment

In GitHub:
1. **Actions** → **Deploy to Production**
2. **Run workflow**
3. Select app (or leave empty for all)
4. Select environment (production/staging)
5. **Run workflow**

---

## 🔧 Configuration

### Environment Variables

#### Database Stack
- `POSTGRES_PASSWORD` (required) - Database password
- `POSTGRES_USER` (optional) - Default: postgres
- `POSTGRES_DB` (optional) - Default: atlas

#### Service Stacks
- `POSTGRES_PASSWORD` (required) - Database password
- `PORT` (optional) - Service port (default: 3000/3001)
- `LOG_LEVEL` (optional) - Logging level (default: info)
- `IMAGE_TAG` (optional) - Docker image tag (default: latest)

### Docker Images

Images are stored at GitHub Container Registry:

```
ghcr.io/ameciclo/atlas/cyclist-profile:latest
ghcr.io/ameciclo/atlas/cyclist-profile:sha-abc123
ghcr.io/ameciclo/atlas/docs:latest
ghcr.io/ameciclo/atlas/docs:sha-abc123
```

---

## 📊 Monitoring

### Health Checks

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
```

### Container Stats

```bash
docker stats atlas-cyclist-profile atlas-docs atlas-postgres
```

---

## 🔄 Rollback

### Option 1: Via Portainer UI

1. Go to **Stacks** → Select stack
2. Click **Editor**
3. Change `IMAGE_TAG` to previous SHA:
   ```yaml
   image: ghcr.io/ameciclo/atlas/cyclist-profile:sha-abc123
   ```
4. **Update the stack**

### Option 2: Via Git Revert

1. Revert the problematic commit
2. Push to main
3. CI/CD deploys the reverted version

---

## 🛡️ Security

### Best Practices

1. ✅ **Secrets** - Use Portainer environment variables for sensitive data
2. ✅ **Network Isolation** - Services communicate via `atlas-network`
3. ✅ **Resource Limits** - CPU and memory limits configured
4. ✅ **Health Checks** - Automatic service health monitoring
5. ✅ **Logging** - Centralized logging with rotation

### Recommendations

- Use reverse proxy (nginx/traefik) for SSL termination
- Configure firewall rules
- Regular security updates
- Image vulnerability scanning (already in CI)

---

## 📚 Documentation Structure

```
.
├── DEPLOYMENT_STRATEGY.md          # Complete strategy (this summary)
├── PORTAINER_DEPLOYMENT_SUMMARY.md # Quick reference
├── deployment/
│   ├── README.md                   # Deployment guide
│   ├── DEPLOYMENT_CHECKLIST.md     # Step-by-step checklist
│   └── portainer/
│       ├── README.md               # Portainer-specific docs
│       ├── database-stack.yml      # Database stack template
│       ├── cyclist-profile-stack.yml # Cyclist Profile stack
│       └── docs-stack.yml          # Docs stack
└── .github/workflows/
    └── deploy.yml                  # Deployment workflow
```

---

## ✅ Next Steps

### 1. Set Up Portainer (if not already done)

- Install Portainer on your server
- Configure access and authentication
- Create `atlas-network` Docker network

### 2. Deploy Stacks

Follow the deployment checklist:
- Deploy database stack
- Deploy service stacks
- Enable webhooks
- Configure GitHub secrets

### 3. Test Deployment

- Make a small change to a service
- Push to main branch
- Verify automatic deployment works

### 4. Add More Services

When adding new services:
1. Create Dockerfile in `apps/<service-name>/`
2. Create stack template in `deployment/portainer/<service-name>-stack.yml`
3. Add webhook secret to GitHub
4. Update deploy.yml matrix with new service

---

## 🎉 Benefits

### For Development
- ✅ **Simple workflow** - Just push to main
- ✅ **Automatic deployments** - No manual steps
- ✅ **Fast feedback** - See changes in production quickly

### For Operations
- ✅ **Independent services** - Deploy services separately
- ✅ **Easy rollback** - Revert to previous versions
- ✅ **Monitoring** - Health checks and logs
- ✅ **Scalability** - Add services easily

### For the Team
- ✅ **Clear documentation** - Comprehensive guides
- ✅ **Reproducible** - Same process every time
- ✅ **Maintainable** - Industry-standard patterns

---

**Your Atlas monorepo now has a production-ready, webhook-based deployment strategy! 🚀**

