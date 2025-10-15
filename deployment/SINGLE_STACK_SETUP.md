# Single Stack Deployment Setup

This guide explains how to deploy Atlas as a **single Portainer stack** with all services (database, cyclist-profile, docs) instead of separate stacks.

---

## 🎯 Overview

### Your Setup: Single Stack

```
atlas (Portainer Stack)
├── postgres (service)
├── cyclist-profile-migrate (service)
├── cyclist-profile (service)
└── docs (service)
```

**Benefits:**
- ✅ All services in one place
- ✅ Single webhook updates all services
- ✅ Easier to manage
- ✅ Services can reference each other easily

**Trade-off:**
- ⚠️ Webhook updates ALL services, not just affected ones
- ⚠️ Can't deploy services independently via webhook

---

## 📦 How Docs Deployment Works

### 1. Build Phase (GitHub Actions)

When you change docs code:

```bash
# You change: apps/docs/src/pages/index.tsx
git push origin main
```

**GitHub Actions:**
```
1. CI workflow runs tests
2. Docker workflow detects "docs" was changed
3. Builds Docker image: ghcr.io/ameciclo/atlas/docs:latest
4. Pushes to GitHub Container Registry
5. Deploy workflow triggers
```

### 2. Deploy Phase (Portainer Webhook)

**GitHub Actions calls webhook:**
```bash
POST https://portainer.example.com/api/webhooks/abc123-def456
```

**Portainer receives webhook:**
```
1. Pulls latest images for ALL services:
   - ghcr.io/ameciclo/atlas/cyclist-profile:latest
   - ghcr.io/ameciclo/atlas/docs:latest

2. Restarts ALL services in the stack:
   - postgres (stays running, no restart)
   - cyclist-profile-migrate (runs migrations)
   - cyclist-profile (restarts with new image)
   - docs (restarts with new image) ← Your change!

3. Health checks verify all services are healthy
```

**Result:**
- Docs service updated with new code
- All other services also restarted (even if unchanged)

---

## 🔧 Environment Variables Setup

### In Portainer (Stack Environment Variables)

When you create the "atlas" stack in Portainer, set these variables:

#### Required Variables

```bash
# Database password (REQUIRED)
POSTGRES_PASSWORD=your-secure-password-here
```

#### Optional Variables (with defaults)

```bash
# Database settings
POSTGRES_USER=postgres              # Default: postgres
POSTGRES_DB=atlas                   # Default: atlas
POSTGRES_PORT=5432                  # Default: 5432

# Service ports
CYCLIST_PROFILE_PORT=3000           # Default: 3000
DOCS_PORT=3001                      # Default: 3001

# Application settings
LOG_LEVEL=info                      # Default: info (options: debug, info, warn, error)
NODE_ENV=production                 # Default: production

# Docker image tag
IMAGE_TAG=latest                    # Default: latest (can use: sha-abc123, main, etc.)

# Database performance tuning
POSTGRES_SHARED_BUFFERS=256MB       # Default: 256MB
POSTGRES_EFFECTIVE_CACHE_SIZE=1GB   # Default: 1GB
POSTGRES_MAX_CONNECTIONS=100        # Default: 100
```

---

### In GitHub (Repository Secrets)

Go to: **GitHub → Settings → Secrets and variables → Actions**

#### Required Secret

```bash
# Portainer webhook URL for the atlas stack
PORTAINER_WEBHOOK_ATLAS=https://portainer.example.com/api/webhooks/abc123-def456
```

**How to get this:**
1. In Portainer, go to **Stacks** → **atlas**
2. Click **Webhooks** tab
3. Click **Enable webhook**
4. Copy the webhook URL
5. Add to GitHub secrets as `PORTAINER_WEBHOOK_ATLAS`

---

## 🚀 Step-by-Step Setup

### Step 1: Create Docker Network

```bash
docker network create atlas-network
```

### Step 2: Deploy Stack in Portainer

1. **Login to Portainer**
2. **Go to Stacks** → **Add stack**
3. **Name:** `atlas`
4. **Build method:** Web editor
5. **Copy content** from `deployment/portainer/atlas-stack.yml`
6. **Set environment variables:**
   ```
   POSTGRES_PASSWORD=your-secure-password
   ```
7. **Click "Deploy the stack"**

### Step 3: Verify Services Are Running

```bash
# Check all containers
docker ps | grep atlas

# Should see:
# atlas-postgres
# atlas-cyclist-profile-migrate (exited - this is normal)
# atlas-cyclist-profile
# atlas-docs

# Check health
docker exec atlas-postgres pg_isready -U postgres -d atlas
curl http://localhost:3000/health
curl http://localhost:3001/
```

### Step 4: Enable Webhook

1. **In Portainer:** Stacks → atlas → Webhooks
2. **Click "Enable webhook"**
3. **Copy webhook URL** (looks like: `https://portainer.example.com/api/webhooks/abc123-def456`)

### Step 5: Add Webhook to GitHub

1. **Go to GitHub:** Settings → Secrets and variables → Actions
2. **Click "New repository secret"**
3. **Name:** `PORTAINER_WEBHOOK_ATLAS`
4. **Value:** Paste the webhook URL
5. **Click "Add secret"**

### Step 6: Use Single Stack Deploy Workflow

Since you have a single stack, use the single-stack deploy workflow:

**Option A: Replace the existing workflow (recommended)**

```bash
# Rename the multi-stack workflow
mv .github/workflows/deploy.yml .github/workflows/deploy-multi-stack.yml.disabled

# Rename the single-stack workflow
mv .github/workflows/deploy-single-stack.yml .github/workflows/deploy.yml

# Commit
git add .github/workflows/
git commit -m "chore: switch to single-stack deployment"
git push
```

**Option B: Manually update deploy.yml**

Replace the content of `.github/workflows/deploy.yml` with the content from `.github/workflows/deploy-single-stack.yml`

---

## ✅ Complete Setup Checklist

Use this checklist to verify everything is configured:

### Portainer Setup

- [ ] Docker network `atlas-network` created
- [ ] Stack `atlas` deployed in Portainer
- [ ] Environment variable `POSTGRES_PASSWORD` set
- [ ] All services running (postgres, cyclist-profile, docs)
- [ ] Health checks passing
- [ ] Webhook enabled for stack
- [ ] Webhook URL copied

### GitHub Setup

- [ ] Secret `PORTAINER_WEBHOOK_ATLAS` added
- [ ] Deploy workflow updated to use single-stack version
- [ ] Workflow file committed and pushed

### Verification

- [ ] Database accessible: `docker exec atlas-postgres pg_isready -U postgres -d atlas`
- [ ] API healthy: `curl http://localhost:3000/health`
- [ ] Docs accessible: `curl http://localhost:3001/`
- [ ] Test deployment: Make small change and push to main
- [ ] Verify webhook triggered in Portainer
- [ ] Verify services restarted with new images

---

## 📊 How It Works - Complete Flow

### Scenario: You Update Docs

```
1. Developer Action
   └─ Edit apps/docs/src/pages/index.tsx
   └─ git push origin main

2. GitHub Actions - CI Workflow
   └─ Run tests
   └─ Build TypeScript
   └─ Generate OpenAPI specs

3. GitHub Actions - Docker Workflow
   └─ Detect changes: "docs" app changed
   └─ Build image: ghcr.io/ameciclo/atlas/docs:latest
   └─ Push to GitHub Container Registry
   └─ Trigger deploy workflow

4. GitHub Actions - Deploy Workflow
   └─ Detect changed apps: ["docs"]
   └─ POST to PORTAINER_WEBHOOK_ATLAS
   └─ Wait 60 seconds

5. Portainer
   └─ Receive webhook
   └─ Pull latest images:
      ├─ ghcr.io/ameciclo/atlas/cyclist-profile:latest
      └─ ghcr.io/ameciclo/atlas/docs:latest
   └─ Restart services:
      ├─ postgres (no restart, stays running)
      ├─ cyclist-profile-migrate (runs migrations)
      ├─ cyclist-profile (restarts)
      └─ docs (restarts) ← Your change!
   └─ Run health checks
   └─ Deployment complete

6. Result
   └─ Docs service updated with new code
   └─ All services healthy
   └─ Total time: ~5-7 minutes
```

---

## 🔄 Comparison: Single Stack vs Multi-Stack

### Single Stack (Your Setup)

**Pros:**
- ✅ Simpler to manage
- ✅ All services in one place
- ✅ Single webhook
- ✅ Services can easily reference each other
- ✅ Easier to understand

**Cons:**
- ⚠️ All services restart on every deployment
- ⚠️ Can't deploy services independently via webhook
- ⚠️ Slightly longer deployment time (all services restart)

**Best for:**
- Small to medium projects
- Tightly coupled services
- Simpler infrastructure

### Multi-Stack (Alternative)

**Pros:**
- ✅ Deploy services independently
- ✅ Only affected services restart
- ✅ Faster deployments (only what changed)
- ✅ Better isolation

**Cons:**
- ⚠️ More complex to manage
- ⚠️ Multiple webhooks to configure
- ⚠️ Services in different stacks

**Best for:**
- Large projects with many services
- Independent services
- High-traffic applications

---

## 🎯 Summary: Environment Variables

### Required in Portainer

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_PASSWORD` | ✅ Yes | - | Database password |

### Optional in Portainer

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_USER` | No | `postgres` | Database user |
| `POSTGRES_DB` | No | `atlas` | Database name |
| `POSTGRES_PORT` | No | `5432` | Database port |
| `CYCLIST_PROFILE_PORT` | No | `3000` | API port |
| `DOCS_PORT` | No | `3001` | Docs port |
| `LOG_LEVEL` | No | `info` | Logging level |
| `IMAGE_TAG` | No | `latest` | Docker image tag |

### Required in GitHub

| Secret | Required | Description |
|--------|----------|-------------|
| `PORTAINER_WEBHOOK_ATLAS` | ✅ Yes | Webhook URL for atlas stack |

---

## 🚀 Next Steps

1. **Deploy the stack** following the step-by-step guide above
2. **Test deployment** by making a small change and pushing
3. **Monitor logs** in Portainer to verify everything works
4. **Add more services** by editing `atlas-stack.yml` and adding new service definitions

---

## 📚 Additional Resources

- **Stack template:** `deployment/portainer/atlas-stack.yml`
- **Deploy workflow:** `.github/workflows/deploy-single-stack.yml`
- **Main deployment guide:** `deployment/README.md`
- **Troubleshooting:** `deployment/portainer/README.md`

---

**Your single-stack deployment is ready to go! 🎉**
