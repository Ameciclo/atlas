# Service-Level Webhooks Setup (Managed Database)

This guide is for your actual setup:
- **Managed PostgreSQL** (Digital Ocean)
- **Service-level webhooks** in Portainer (one webhook per service)
- **Single atlas stack** with multiple services

---

## 🎯 Your Setup

### Architecture

```
Digital Ocean Managed PostgreSQL
         ↓
    (DATABASE_URL)
         ↓
Portainer: atlas stack
├── cyclist-profile-migrate (service) → runs migrations
├── cyclist-profile (service) → webhook: PORTAINER_WEBHOOK_CYCLIST_PROFILE
└── docs (service) → webhook: PORTAINER_WEBHOOK_DOCS
```

**Key Points:**
- ✅ Each service has its own webhook
- ✅ Only affected services are deployed
- ✅ Database is managed externally (Digital Ocean)
- ✅ No postgres container in the stack

---

## 📦 How Docs Deployment Works

### Complete Flow

```
1. You change docs code
   └─ apps/docs/src/pages/index.tsx

2. Push to main
   └─ git push origin main

3. GitHub Actions - CI
   └─ Runs tests
   └─ Builds TypeScript

4. GitHub Actions - Docker
   └─ Detects "docs" changed
   └─ Builds ghcr.io/ameciclo/atlas/docs:latest
   └─ Pushes to GHCR

5. GitHub Actions - Deploy
   └─ Detects "docs" was built
   └─ Calls PORTAINER_WEBHOOK_DOCS
   └─ Skips cyclist-profile (not changed)

6. Portainer
   └─ Receives webhook for docs service
   └─ Pulls ghcr.io/ameciclo/atlas/docs:latest
   └─ Restarts ONLY atlas-docs container
   └─ cyclist-profile keeps running (not affected)

7. Done! ✅
   └─ Only docs service updated
   └─ Total time: ~3-4 minutes
```

---

## 🔧 Environment Variables

### In Portainer (Stack Environment Variables)

#### Required

| Variable | Example | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://user:pass@db.digitalocean.com:25060/atlas?sslmode=require` | Full connection string to managed database |

#### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `CYCLIST_PROFILE_PORT` | `3000` | API port |
| `DOCS_PORT` | `3001` | Docs port |
| `LOG_LEVEL` | `info` | Logging level |
| `IMAGE_TAG` | `latest` | Docker image tag |

---

### In GitHub (Repository Secrets)

#### Required (One per service)

| Secret | Description |
|--------|-------------|
| `PORTAINER_WEBHOOK_CYCLIST_PROFILE` | Webhook URL for cyclist-profile service |
| `PORTAINER_WEBHOOK_DOCS` | Webhook URL for docs service |

---

## 🚀 Step-by-Step Setup

### Step 1: Get Database Connection String

From Digital Ocean:

1. Go to **Databases** → Your PostgreSQL database
2. Click **Connection Details**
3. Copy the connection string
4. Should look like:
   ```
   postgresql://user:password@db-postgresql-nyc3-12345.ondigitalocean.com:25060/atlas?sslmode=require
   ```

### Step 2: Create Docker Network

On your Portainer server:

```bash
docker network create atlas-network
```

### Step 3: Deploy Stack in Portainer

1. **Login to Portainer**
2. **Go to Stacks** → **Add stack**
3. **Name:** `atlas`
4. **Build method:** Web editor
5. **Copy content** from `deployment/portainer/atlas-stack-managed-db.yml`
6. **Set environment variables:**
   ```
   DATABASE_URL=postgresql://user:password@db-postgresql-nyc3-12345.ondigitalocean.com:25060/atlas?sslmode=require
   ```
7. **Click "Deploy the stack"**

### Step 4: Verify Services Are Running

```bash
# Check containers
docker ps | grep atlas

# Should see:
# atlas-cyclist-profile-migrate (exited - this is normal)
# atlas-cyclist-profile (running)
# atlas-docs (running)

# Check health
curl http://localhost:3000/health
curl http://localhost:3001/
```

### Step 5: Enable Service Webhooks

**For cyclist-profile service:**

1. **In Portainer:** Containers → **atlas-cyclist-profile**
2. **Click container name** to view details
3. Look for **Webhook** section or **Duplicate/Edit**
4. **Enable webhook** for the service
5. **Copy webhook URL**
   - Should look like: `https://portainer.example.com/api/webhooks/abc123-def456`

**For docs service:**

6. **In Portainer:** Containers → **atlas-docs**
7. **Click container name** to view details
8. **Enable webhook** for the service
9. **Copy webhook URL**

**Note:** The exact location of webhook settings depends on your Portainer version. Look for:
- "Webhooks" tab in container details
- "Duplicate/Edit" → Webhook section
- Container settings → Advanced → Webhooks

### Step 6: Add Webhooks to GitHub

1. **Go to GitHub:** Settings → Secrets and variables → Actions
2. **Add first secret:**
   - Name: `PORTAINER_WEBHOOK_CYCLIST_PROFILE`
   - Value: (paste cyclist-profile webhook URL)
   - Click "Add secret"
3. **Add second secret:**
   - Name: `PORTAINER_WEBHOOK_DOCS`
   - Value: (paste docs webhook URL)
   - Click "Add secret"

### Step 7: Test Deployment

```bash
# Make a small change to docs
echo "# Test" >> apps/docs/README.md

# Commit and push
git add .
git commit -m "test: verify docs deployment"
git push origin main

# Watch GitHub Actions
# Should see:
# - CI runs
# - Docker builds docs image
# - Deploy triggers PORTAINER_WEBHOOK_DOCS only
# - Portainer updates atlas-docs service only
```

---

## ✅ Complete Setup Checklist

### Digital Ocean

- [ ] PostgreSQL database created
- [ ] Connection string copied
- [ ] SSL mode enabled (recommended)
- [ ] Firewall allows connections from Portainer server

### Portainer

- [ ] Docker network `atlas-network` created
- [ ] Stack `atlas` deployed
- [ ] Environment variable `DATABASE_URL` set
- [ ] Services running (cyclist-profile, docs)
- [ ] Health checks passing
- [ ] Webhook enabled for `atlas-cyclist-profile` service
- [ ] Webhook enabled for `atlas-docs` service
- [ ] Both webhook URLs copied

### GitHub

- [ ] Secret `PORTAINER_WEBHOOK_CYCLIST_PROFILE` added
- [ ] Secret `PORTAINER_WEBHOOK_DOCS` added
- [ ] Deploy workflow committed and pushed

### Verification

- [ ] API healthy: `curl http://localhost:3000/health`
- [ ] Docs accessible: `curl http://localhost:3001/`
- [ ] Database connection works (check API logs)
- [ ] Test deployment: Change docs, push, verify only docs updates
- [ ] Test deployment: Change API, push, verify only API updates

---

## 🔍 How Service Webhooks Work

### Service-Level vs Stack-Level

**Service-Level Webhooks (Your Setup):**
```
PORTAINER_WEBHOOK_CYCLIST_PROFILE → Updates only atlas-cyclist-profile
PORTAINER_WEBHOOK_DOCS → Updates only atlas-docs
```

**Benefits:**
- ✅ Only affected service restarts
- ✅ Faster deployments
- ✅ Less downtime
- ✅ Independent service updates

**Stack-Level Webhooks (Alternative):**
```
PORTAINER_WEBHOOK_ATLAS → Updates ALL services in stack
```

**Trade-off:**
- ⚠️ All services restart
- ⚠️ Slower deployments
- ⚠️ More downtime

---

## 📊 Deployment Scenarios

### Scenario 1: Only Docs Changed

```
GitHub Actions:
  ✓ Build docs image
  ✗ Skip cyclist-profile image

Deploy:
  ✓ Call PORTAINER_WEBHOOK_DOCS
  ✗ Skip PORTAINER_WEBHOOK_CYCLIST_PROFILE

Portainer:
  ✓ Update atlas-docs
  ✗ atlas-cyclist-profile keeps running

Result: Only docs restarted
```

### Scenario 2: Only API Changed

```
GitHub Actions:
  ✗ Skip docs image
  ✓ Build cyclist-profile image

Deploy:
  ✗ Skip PORTAINER_WEBHOOK_DOCS
  ✓ Call PORTAINER_WEBHOOK_CYCLIST_PROFILE

Portainer:
  ✗ atlas-docs keeps running
  ✓ Update atlas-cyclist-profile (runs migrations first)

Result: Only API restarted
```

### Scenario 3: Both Changed

```
GitHub Actions:
  ✓ Build docs image
  ✓ Build cyclist-profile image

Deploy:
  ✓ Call PORTAINER_WEBHOOK_DOCS
  ✓ Call PORTAINER_WEBHOOK_CYCLIST_PROFILE

Portainer:
  ✓ Update atlas-docs
  ✓ Update atlas-cyclist-profile

Result: Both services restarted
```

---

## 🔐 Security: DATABASE_URL

### Best Practices

**Do:**
- ✅ Use SSL mode: `?sslmode=require`
- ✅ Use strong password
- ✅ Restrict database access to Portainer server IP
- ✅ Use Digital Ocean's private network if possible
- ✅ Rotate credentials periodically

**Don't:**
- ❌ Commit DATABASE_URL to git
- ❌ Log DATABASE_URL in application
- ❌ Share DATABASE_URL publicly
- ❌ Use weak passwords

### Example DATABASE_URL

```bash
# Format
postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE?sslmode=require

# Example (Digital Ocean)
postgresql://doadmin:abc123xyz@db-postgresql-nyc3-12345.ondigitalocean.com:25060/atlas?sslmode=require

# Example (with special characters in password)
postgresql://doadmin:p%40ssw%23rd@db-postgresql-nyc3-12345.ondigitalocean.com:25060/atlas?sslmode=require
```

**Note:** URL-encode special characters in password:
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- `%` → `%25`

---

## 🛠️ Troubleshooting

### "Cannot find package '@atlas/database'"

**Cause:** Database package not built before tests/generate-openapi

**Fix:** Already fixed in `turbo.json`:
```json
{
  "test": {
    "dependsOn": ["^build"]  // Builds dependencies first
  },
  "generate-openapi": {
    "dependsOn": ["^build"]  // Builds dependencies first
  }
}
```

### "Database connection failed"

**Check:**
1. DATABASE_URL is correct in Portainer
2. SSL mode is set: `?sslmode=require`
3. Portainer server IP is allowed in Digital Ocean firewall
4. Database is running in Digital Ocean
5. Check service logs: `docker logs atlas-cyclist-profile`

### "Webhook not triggering"

**Check:**
1. Webhook URL is correct in GitHub secrets
2. Webhook is enabled for the SERVICE (not stack)
3. Portainer is accessible from GitHub Actions
4. Check GitHub Actions logs for webhook response

### "Service won't start after deployment"

**Check:**
1. New image exists in GHCR
2. DATABASE_URL is still valid
3. Migrations completed successfully
4. Check logs: `docker logs atlas-cyclist-profile`
5. Check migration logs: `docker logs atlas-cyclist-profile-migrate`

---

## 📚 Files for Your Setup

- **Stack template:** `deployment/portainer/atlas-stack-managed-db.yml`
- **Deploy workflow:** `.github/workflows/deploy.yml` (already configured)
- **This guide:** `deployment/SERVICE_WEBHOOKS_SETUP.md`
- **Variables reference:** `deployment/VARIABLES_REFERENCE.md`

---

## ✅ Summary

### What You Have

1. ✅ **Managed PostgreSQL** on Digital Ocean
2. ✅ **Service-level webhooks** for independent deployments
3. ✅ **Optimized CI** - database package builds first
4. ✅ **Affected-only deployments** - only changed services update

### What You Need

**In Portainer:**
- `DATABASE_URL` (connection string to Digital Ocean)

**In GitHub:**
- `PORTAINER_WEBHOOK_CYCLIST_PROFILE` (service webhook URL)
- `PORTAINER_WEBHOOK_DOCS` (service webhook URL)

---

**Your deployment is optimized and ready! 🚀**

