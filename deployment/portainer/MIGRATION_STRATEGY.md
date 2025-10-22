# Database Migration Strategy

## Overview

Database migrations are now handled by the CI/CD pipeline **before** deploying new application versions. This ensures zero-downtime deployments and prevents race conditions.

---

## 🎯 **How It Works**

### **Workflow Sequence**

```mermaid
graph TD
    A[Push to main] --> B[Build Docker Images]
    B --> C{API apps changed?}
    C -->|Yes| D[Run Migrations]
    C -->|No| E[Skip Migrations]
    D --> F[Deploy to Portainer]
    E --> F
    F --> G[Health Checks]
```

### **Step-by-Step**

1. **Code Push**: Developer pushes code to `main` branch
2. **Build**: GitHub Actions builds Docker images for changed apps
3. **Migrations**: If API apps changed, run database migrations
4. **Deploy**: Trigger Portainer webhooks to update containers
5. **Verify**: Wait for containers to restart and verify health

---

## 📋 **Required GitHub Secrets**

Add these secrets to your GitHub repository:

### **Database Connection**
```
DATABASE_URL=postgresql://user:password@host:5432/atlas?sslmode=require
```

### **Portainer Webhooks**
```
PORTAINER_WEBHOOK_CYCLIST_PROFILE=https://portainer.example.com/api/webhooks/...
PORTAINER_WEBHOOK_CYCLIST_COUNTS=https://portainer.example.com/api/webhooks/...
PORTAINER_WEBHOOK_DOCS=https://portainer.example.com/api/webhooks/...
```

---

## 🔧 **Setup Instructions**

### **1. Configure GitHub Secrets**

Go to: `Settings` → `Secrets and variables` → `Actions` → `New repository secret`

Add each secret listed above.

### **2. Update Portainer Stack**

Replace your current stack with `atlas-stack-kong-cicd.yml`:

```bash
# In Portainer UI:
# 1. Go to Stacks → atlas
# 2. Click "Editor"
# 3. Replace content with atlas-stack-kong-cicd.yml
# 4. Click "Update the stack"
```

**Key Changes:**
- ✅ Removed `cyclist-profile-migrate` init container
- ✅ Removed `cyclist-counts-migrate` init container
- ✅ Removed `depends_on` for migration containers
- ✅ Simplified stack configuration

### **3. Enable Service Webhooks**

For each service, enable webhooks in Portainer:

#### **Cyclist Profile**
1. Go to: `Containers` → `atlas-cyclist-profile`
2. Click container name to view details
3. Scroll to "Webhook" section
4. Click "Create a webhook"
5. Copy the webhook URL
6. Add to GitHub secrets as `PORTAINER_WEBHOOK_CYCLIST_PROFILE`

#### **Cyclist Counts**
1. Go to: `Containers` → `atlas-cyclist-counts`
2. Click container name to view details
3. Scroll to "Webhook" section
4. Click "Create a webhook"
5. Copy the webhook URL
6. Add to GitHub secrets as `PORTAINER_WEBHOOK_CYCLIST_COUNTS`

#### **Docs**
1. Go to: `Containers` → `atlas-docs`
2. Click container name to view details
3. Scroll to "Webhook" section
4. Click "Create a webhook"
5. Copy the webhook URL
6. Add to GitHub secrets as `PORTAINER_WEBHOOK_DOCS`

---

## 🚀 **Deployment Process**

### **Automatic Deployment (Recommended)**

Deployments happen automatically when you push to `main`:

```bash
git checkout main
git pull
git merge feature-branch
git push origin main
```

GitHub Actions will:
1. ✅ Build Docker images
2. ✅ Run migrations (if needed)
3. ✅ Deploy to Portainer
4. ✅ Verify health

### **Manual Deployment**

You can also trigger deployments manually:

1. Go to: `Actions` → `Deploy with Migrations`
2. Click "Run workflow"
3. Select options:
   - **App**: Leave empty for all, or specify `cyclist-profile`, `cyclist-counts`, or `docs`
   - **Skip migrations**: Check to skip migrations (use with caution!)
4. Click "Run workflow"

---

## 🔍 **Monitoring Deployments**

### **GitHub Actions**

View deployment progress:
1. Go to: `Actions` tab
2. Click on the running workflow
3. Monitor each job:
   - ✅ Detect Apps to Deploy
   - ✅ Run Database Migrations
   - ✅ Deploy Cyclist Profile
   - ✅ Deploy Cyclist Counts
   - ✅ Deploy Docs

### **Portainer**

View container status:
1. Go to: `Containers`
2. Check status of:
   - `atlas-cyclist-profile`
   - `atlas-cyclist-counts`
   - `atlas-docs`
3. View logs for each container

---

## ⚠️ **Troubleshooting**

### **Migration Failed**

If migrations fail, deployment is **automatically cancelled**:

1. Check GitHub Actions logs for error details
2. Fix the migration issue
3. Push the fix to `main`
4. Deployment will retry automatically

### **Deployment Failed**

If Portainer webhook fails:

1. Verify webhook URL is correct in GitHub secrets
2. Check Portainer is accessible from GitHub Actions
3. Verify container exists in Portainer
4. Check Portainer logs

### **Rollback**

To rollback a deployment:

```bash
# Option 1: Revert the commit
git revert HEAD
git push origin main

# Option 2: Manual rollback in Portainer
# 1. Go to container in Portainer
# 2. Click "Duplicate/Edit"
# 3. Change image tag to previous version
# 4. Click "Deploy the container"
```

---

## 🎓 **Best Practices**

### **✅ DO**

- ✅ Test migrations locally before pushing
- ✅ Make migrations backward-compatible
- ✅ Use transactions in migrations
- ✅ Monitor deployment logs
- ✅ Keep migrations idempotent

### **❌ DON'T**

- ❌ Skip migrations in production
- ❌ Make breaking schema changes without coordination
- ❌ Delete columns without deprecation period
- ❌ Run migrations manually in production

---

## 📚 **Migration Guidelines**

### **Writing Safe Migrations**

```typescript
// ✅ GOOD: Backward-compatible
// 1. Add new column (nullable)
await db.schema.alterTable('users')
  .addColumn('email', 'text')
  .execute();

// 2. Backfill data
await db.updateTable('users')
  .set({ email: 'default@example.com' })
  .where('email', 'is', null)
  .execute();

// 3. Make column required (in next migration)
await db.schema.alterTable('users')
  .alterColumn('email', (col) => col.setNotNull())
  .execute();
```

```typescript
// ❌ BAD: Breaking change
await db.schema.alterTable('users')
  .dropColumn('old_field')  // Breaks old code!
  .execute();
```

### **Testing Migrations**

```bash
# Test locally
pnpm --filter @atlas/database build
node packages/database/dist/migrate.js

# Verify schema
psql $DATABASE_URL -c "\d+ users"
```

---

## 🔐 **Security Considerations**

- ✅ DATABASE_URL is stored as GitHub secret (encrypted)
- ✅ Migrations run in isolated GitHub Actions runner
- ✅ No database credentials in code or logs
- ✅ SSL/TLS enforced for database connections

---

## 📊 **Comparison: Old vs New**

| Aspect | Old (Init Containers) | New (CI/CD) |
|--------|----------------------|-------------|
| **When migrations run** | On container start | Before deployment |
| **Race conditions** | ❌ Possible with replicas | ✅ Runs once |
| **Zero-downtime** | ❌ No | ✅ Yes |
| **Rollback** | ❌ Difficult | ✅ Easy |
| **Monitoring** | ⚠️ Portainer logs | ✅ GitHub Actions |
| **Control** | ❌ Automatic only | ✅ Manual option |
| **Debugging** | ❌ Harder | ✅ Easier |

---

## 🆘 **Support**

If you encounter issues:

1. Check GitHub Actions logs
2. Check Portainer container logs
3. Verify GitHub secrets are configured
4. Verify Portainer webhooks are enabled
5. Contact DevOps team

---

**Last Updated**: 2025-10-22
**Version**: 1.0.0

