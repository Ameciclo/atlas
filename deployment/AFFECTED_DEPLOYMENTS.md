# Affected-Only Deployments

This document explains how the deployment pipeline is optimized to **only build and deploy services that were actually changed**.

## 🎯 Overview

The Atlas deployment pipeline uses **Turborepo's affected detection** to ensure:

1. ✅ **Only changed apps are built** into Docker images
2. ✅ **Only built apps are deployed** to Portainer
3. ✅ **No wasted time** building/deploying unchanged services
4. ✅ **Faster deployments** - only what's needed

---

## 🔍 How It Works

### Phase 1: Detect Changes (Docker Build)

**Workflow:** `.github/workflows/docker.yml`

```yaml
detect_changes:
  - Find all apps with Dockerfiles
  - Use Turborepo: turbo run build --dry-run=json --filter=...[HEAD^1]
  - Detect which apps were affected by changes
  - Output matrix of affected apps
  
build_and_push:
  - Only runs if has_changes == true
  - Builds Docker images for affected apps only
  - Pushes to GHCR
```

**Example:**

```bash
# You change: apps/cyclist-profile/src/routes/stats.ts

# Turborepo detects:
AFFECTED_APPS = ["cyclist-profile"]

# Docker builds:
✓ cyclist-profile → ghcr.io/ameciclo/atlas/cyclist-profile:latest
✗ docs → SKIPPED (not affected)
```

---

### Phase 2: Detect Deployments (Deploy)

**Workflow:** `.github/workflows/deploy.yml`

```yaml
detect_deployed_apps:
  - Find all apps with Dockerfiles
  - Use Turborepo: turbo run build --dry-run=json --filter=...[HEAD^1]
  - Detect which apps were affected (same logic as docker.yml)
  - Map to deployment matrix with webhook secrets
  - Output matrix of apps to deploy
  
deploy:
  - Only runs if has_deployments == true
  - Triggers webhooks for affected apps only
  - Portainer pulls and restarts only those services
```

**Example:**

```bash
# Continuing from above...

# Turborepo detects:
AFFECTED_APPS = ["cyclist-profile"]

# Deploy triggers:
✓ cyclist-profile → POST to PORTAINER_WEBHOOK_CYCLIST_PROFILE
✗ docs → SKIPPED (not affected)

# Portainer updates:
✓ cyclist-profile → Pull new image, restart service
✗ docs → No action (keeps running)
```

---

## 📊 Real-World Examples

### Example 1: Change Only Cyclist Profile

**Change:**
```typescript
// apps/cyclist-profile/src/routes/stats.ts
export const getStats = async (c: Context) => {
  // New endpoint
}
```

**Pipeline:**

```
1. Detect Changes
   ✓ cyclist-profile (affected)
   ✗ docs (not affected)

2. Docker Build
   ✓ Build cyclist-profile image (3 min)
   ✗ Skip docs image
   
3. Deploy
   ✓ Deploy cyclist-profile (30 sec)
   ✗ Skip docs
   
Total Time: ~3.5 minutes
```

**Without optimization:**
```
Total Time: ~6-7 minutes (builds and deploys both)
Savings: ~3 minutes (50% faster!)
```

---

### Example 2: Change Only Docs

**Change:**
```typescript
// apps/docs/src/pages/index.tsx
<h1>Updated Documentation</h1>
```

**Pipeline:**

```
1. Detect Changes
   ✗ cyclist-profile (not affected)
   ✓ docs (affected)

2. Docker Build
   ✗ Skip cyclist-profile image
   ✓ Build docs image (2 min)
   
3. Deploy
   ✗ Skip cyclist-profile
   ✓ Deploy docs (30 sec)
   
Total Time: ~2.5 minutes
```

---

### Example 3: Change Shared Database Package

**Change:**
```typescript
// packages/database/src/schema-manager.ts
// Update schema manager logic
```

**Pipeline:**

```
1. Detect Changes
   ✓ cyclist-profile (depends on database)
   ✗ docs (doesn't depend on database)

2. Docker Build
   ✓ Build cyclist-profile image (3 min)
   ✗ Skip docs image
   
3. Deploy
   ✓ Deploy cyclist-profile (30 sec)
   ✗ Skip docs
   
Total Time: ~3.5 minutes
```

**Why cyclist-profile is affected:**
- Turborepo detects dependency graph
- `cyclist-profile` depends on `@atlas/database`
- Changes to `database` affect `cyclist-profile`
- `docs` doesn't depend on `database`, so it's not affected

---

### Example 4: Change Only README

**Change:**
```markdown
# README.md
Updated documentation
```

**Pipeline:**

```
1. Detect Changes
   ✗ cyclist-profile (not affected)
   ✗ docs (not affected)

2. Docker Build
   ✗ Skip all (no apps affected)
   
3. Deploy
   ✗ Skip all (nothing to deploy)
   
Total Time: ~1 minute (just CI tests)
```

**Note:** `.md` files are ignored in `docker.yml` paths-ignore

---

## 🔧 Technical Details

### Turborepo Affected Detection

**Command:**
```bash
turbo run build --dry-run=json --filter=...[HEAD^1]
```

**What it does:**
1. Compares current commit with previous commit (`HEAD^1`)
2. Analyzes dependency graph
3. Determines which packages/apps are affected
4. Returns JSON with affected tasks

**Output example:**
```json
{
  "tasks": [
    {
      "taskId": "@atlas/cyclist-profile:build",
      "task": "build",
      "package": "@atlas/cyclist-profile"
    }
  ]
}
```

**Processing:**
```bash
# Extract app names
jq -c '.tasks | map(.taskId | split(":")[0] | select(startswith("@atlas/"))) | map(sub("@atlas/"; "")) | unique'

# Result: ["cyclist-profile"]
```

---

### Deployment Matrix

**All apps with webhooks:**
```json
[
  {
    "app": "cyclist-profile",
    "webhook_secret": "PORTAINER_WEBHOOK_CYCLIST_PROFILE"
  },
  {
    "app": "docs",
    "webhook_secret": "PORTAINER_WEBHOOK_DOCS"
  }
]
```

**Filtered to affected apps:**
```bash
# If affected apps = ["cyclist-profile"]
# Then deployment matrix = [{"app": "cyclist-profile", "webhook_secret": "..."}]
```

**GitHub Actions matrix:**
```yaml
strategy:
  matrix:
    include: ${{ fromJson(needs.detect_deployed_apps.outputs.matrix) }}
```

---

## 🎮 Deployment Scenarios

### Automatic Deployment (Push to Main)

**Behavior:**
- ✅ Detects affected apps automatically
- ✅ Builds only affected apps
- ✅ Deploys only affected apps

**Example:**
```bash
git push origin main
# Only changed services are built and deployed
```

---

### Manual Deployment (Specific App)

**Behavior:**
- ✅ Deploys only the specified app
- ✅ Uses latest image from GHCR
- ✅ Ignores affected detection

**Example:**
```
GitHub Actions → Deploy to Production → Run workflow
App: cyclist-profile
Environment: production
```

**Result:**
- Only `cyclist-profile` is deployed
- Uses existing image (no build)

---

### Manual Deployment (All Apps)

**Behavior:**
- ✅ Deploys all apps
- ✅ Uses latest images from GHCR
- ✅ Ignores affected detection

**Example:**
```
GitHub Actions → Deploy to Production → Run workflow
App: (leave empty)
Environment: production
```

**Result:**
- All apps are deployed
- Uses existing images (no build)

---

## 📈 Performance Benefits

### Time Savings

**Scenario: Change 1 of 2 apps**

| Phase | Without Optimization | With Optimization | Savings |
|-------|---------------------|-------------------|---------|
| Build | 6 min (both apps) | 3 min (1 app) | 50% |
| Deploy | 1 min (both apps) | 30 sec (1 app) | 50% |
| **Total** | **7 min** | **3.5 min** | **50%** |

**Scenario: Change 1 of 5 apps**

| Phase | Without Optimization | With Optimization | Savings |
|-------|---------------------|-------------------|---------|
| Build | 15 min (all apps) | 3 min (1 app) | 80% |
| Deploy | 2.5 min (all apps) | 30 sec (1 app) | 80% |
| **Total** | **17.5 min** | **3.5 min** | **80%** |

**As you add more services, the savings increase!**

---

### Resource Savings

**GitHub Actions minutes:**
- Without optimization: ~7 min per push
- With optimization: ~3.5 min per push (average)
- **Savings: ~50% of CI/CD minutes**

**Portainer resources:**
- Without optimization: All services restart on every deploy
- With optimization: Only affected services restart
- **Benefit: Less downtime, less resource churn**

---

## 🔍 Debugging

### Check What Will Be Deployed

**Before pushing:**
```bash
# See what Turborepo detects as affected
npx turbo run build --dry-run=json --filter=...[HEAD^1] | jq '.tasks | map(.package)'
```

**In GitHub Actions:**
```
1. Go to Actions tab
2. Click on workflow run
3. Check "Detect Apps to Deploy" job
4. See output: "✅ Will deploy: cyclist-profile"
```

---

### Force Deploy All Services

**Option 1: Manual workflow**
```
GitHub Actions → Deploy to Production → Run workflow
App: (leave empty)
Environment: production
```

**Option 2: Modify workflow temporarily**
```yaml
# In deploy.yml, change:
DEPLOY_MATRIX=$ALL_APPS  # Forces all apps
```

---

## 🎯 Adding New Services

When you add a new service with deployment:

**1. Add Dockerfile**
```dockerfile
# apps/new-service/Dockerfile
```

**2. Add to deployment matrix**
```yaml
# .github/workflows/deploy.yml
ALL_APPS='[
  {"app": "cyclist-profile", "webhook_secret": "PORTAINER_WEBHOOK_CYCLIST_PROFILE"},
  {"app": "docs", "webhook_secret": "PORTAINER_WEBHOOK_DOCS"},
  {"app": "new-service", "webhook_secret": "PORTAINER_WEBHOOK_NEW_SERVICE"}
]'
```

**3. Add webhook secret**
```
GitHub → Settings → Secrets → Actions
Add: PORTAINER_WEBHOOK_NEW_SERVICE
```

**4. Create Portainer stack**
```yaml
# deployment/portainer/new-service-stack.yml
```

**That's it!** The service will automatically be:
- Detected when changed
- Built when affected
- Deployed when built

---

## ✅ Summary

### What You Get

1. ✅ **Automatic detection** - Turborepo finds affected apps
2. ✅ **Optimized builds** - Only changed apps are built
3. ✅ **Optimized deploys** - Only built apps are deployed
4. ✅ **Time savings** - 50-80% faster deployments
5. ✅ **Resource savings** - Less CI/CD minutes, less server churn
6. ✅ **Scalable** - More services = more savings

### What You Don't Need to Do

- ❌ Manually specify which apps to build
- ❌ Manually specify which apps to deploy
- ❌ Wait for unchanged services to build
- ❌ Restart services that didn't change

---

**Your deployment pipeline is now fully optimized! 🚀**

