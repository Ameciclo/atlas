# Environment Variables Reference

Quick reference for all environment variables needed for Atlas deployment.

---

## 🎯 Quick Summary

### In Portainer (1 required variable)

```bash
POSTGRES_PASSWORD=your-secure-password-here
```

### In GitHub (1 required secret)

```bash
PORTAINER_WEBHOOK_ATLAS=https://portainer.example.com/api/webhooks/abc123-def456
```

**That's it!** Everything else has sensible defaults.

---

## 📋 Complete Variable List

### Portainer Stack Environment Variables

Set these when creating the "atlas" stack in Portainer.

#### Required

| Variable | Example | Description |
|----------|---------|-------------|
| `POSTGRES_PASSWORD` | `MySecurePass123!` | Database password for PostgreSQL |

#### Optional - Database

| Variable | Default | Example | Description |
|----------|---------|---------|-------------|
| `POSTGRES_USER` | `postgres` | `postgres` | Database username |
| `POSTGRES_DB` | `atlas` | `atlas` | Database name |
| `POSTGRES_PORT` | `5432` | `5432` | PostgreSQL port (external) |
| `POSTGRES_SHARED_BUFFERS` | `256MB` | `512MB` | PostgreSQL shared buffers |
| `POSTGRES_EFFECTIVE_CACHE_SIZE` | `1GB` | `2GB` | PostgreSQL cache size |
| `POSTGRES_MAX_CONNECTIONS` | `100` | `200` | Max database connections |

#### Optional - Services

| Variable | Default | Example | Description |
|----------|---------|---------|-------------|
| `CYCLIST_PROFILE_PORT` | `3000` | `3000` | Cyclist Profile API port |
| `DOCS_PORT` | `3001` | `3001` | Documentation site port |
| `LOG_LEVEL` | `info` | `debug` | Logging level (debug, info, warn, error) |
| `NODE_ENV` | `production` | `production` | Node environment |
| `IMAGE_TAG` | `latest` | `sha-abc123` | Docker image tag to use |

---

### GitHub Repository Secrets

Set these in: **GitHub → Settings → Secrets and variables → Actions**

#### Required

| Secret Name | Example Value | Description |
|-------------|---------------|-------------|
| `PORTAINER_WEBHOOK_ATLAS` | `https://portainer.example.com/api/webhooks/abc123-def456` | Webhook URL for atlas stack |

#### How to Get Webhook URL

1. In Portainer: **Stacks** → **atlas** → **Webhooks**
2. Click **Enable webhook**
3. Copy the webhook URL
4. Add to GitHub secrets

---

## 🔧 How to Set Variables

### In Portainer

**When creating the stack:**

1. Go to **Stacks** → **Add stack**
2. Name: `atlas`
3. Paste stack YAML content
4. Scroll down to **Environment variables**
5. Click **Add an environment variable**
6. Add variables:
   ```
   Name: POSTGRES_PASSWORD
   Value: your-secure-password
   ```
7. Click **Deploy the stack**

**After stack is created:**

1. Go to **Stacks** → **atlas**
2. Click **Editor**
3. Scroll down to **Environment variables**
4. Click **Add an environment variable**
5. Add/edit variables
6. Click **Update the stack**

---

### In GitHub

1. Go to your repository on GitHub
2. Click **Settings** (top menu)
3. Click **Secrets and variables** → **Actions** (left sidebar)
4. Click **New repository secret**
5. Add secret:
   ```
   Name: PORTAINER_WEBHOOK_ATLAS
   Value: https://portainer.example.com/api/webhooks/abc123-def456
   ```
6. Click **Add secret**

---

## 📊 Variable Usage by Service

### Database (postgres)

**Uses:**
- `POSTGRES_USER`
- `POSTGRES_PASSWORD` ✅ Required
- `POSTGRES_DB`
- `POSTGRES_SHARED_BUFFERS`
- `POSTGRES_EFFECTIVE_CACHE_SIZE`
- `POSTGRES_MAX_CONNECTIONS`

**Connection string:**
```
postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
```

---

### Cyclist Profile API (cyclist-profile)

**Uses:**
- `CYCLIST_PROFILE_PORT`
- `LOG_LEVEL`
- `NODE_ENV`
- `IMAGE_TAG`
- `POSTGRES_USER` (for DATABASE_URL)
- `POSTGRES_PASSWORD` (for DATABASE_URL) ✅ Required
- `POSTGRES_DB` (for DATABASE_URL)

**Environment variables set:**
```bash
NODE_ENV=production
LOG_LEVEL=info
PORT=3000
DATABASE_URL=postgresql://postgres:password@postgres:5432/atlas
```

---

### Cyclist Profile Migration (cyclist-profile-migrate)

**Uses:**
- `IMAGE_TAG`
- `POSTGRES_USER` (for DATABASE_URL)
- `POSTGRES_PASSWORD` (for DATABASE_URL) ✅ Required
- `POSTGRES_DB` (for DATABASE_URL)

**Environment variables set:**
```bash
NODE_ENV=production
DATABASE_URL=postgresql://postgres:password@postgres:5432/atlas
```

---

### Documentation (docs)

**Uses:**
- `DOCS_PORT`
- `LOG_LEVEL`
- `NODE_ENV`
- `IMAGE_TAG`

**Environment variables set:**
```bash
NODE_ENV=production
LOG_LEVEL=info
PORT=3001
```

---

## 🔐 Security Best Practices

### For POSTGRES_PASSWORD

**Do:**
- ✅ Use a strong, random password (20+ characters)
- ✅ Include uppercase, lowercase, numbers, and symbols
- ✅ Store securely (password manager)
- ✅ Rotate periodically

**Don't:**
- ❌ Use simple passwords like "password123"
- ❌ Commit to git
- ❌ Share in plain text
- ❌ Reuse from other systems

**Generate secure password:**
```bash
# On macOS/Linux
openssl rand -base64 32

# Example output: 8xK9mP2nQ7vR4sT6uW8yZ1aB3cD5eF7g
```

---

### For PORTAINER_WEBHOOK_ATLAS

**Do:**
- ✅ Keep the URL secret
- ✅ Only add to GitHub secrets
- ✅ Regenerate if exposed

**Don't:**
- ❌ Commit to git
- ❌ Share publicly
- ❌ Log in application code

**If webhook is exposed:**
1. In Portainer: **Stacks** → **atlas** → **Webhooks**
2. Click **Disable webhook**
3. Click **Enable webhook** (generates new URL)
4. Update GitHub secret with new URL

---

## 🎯 Common Configurations

### Development/Staging

```bash
# Portainer variables
POSTGRES_PASSWORD=dev-password-123
LOG_LEVEL=debug
IMAGE_TAG=main
```

### Production

```bash
# Portainer variables
POSTGRES_PASSWORD=super-secure-random-password-here
LOG_LEVEL=info
IMAGE_TAG=latest
POSTGRES_SHARED_BUFFERS=512MB
POSTGRES_EFFECTIVE_CACHE_SIZE=2GB
```

### Custom Ports (Behind Reverse Proxy)

```bash
# Portainer variables
POSTGRES_PASSWORD=your-password
CYCLIST_PROFILE_PORT=8080
DOCS_PORT=8081
```

---

## 🔍 Troubleshooting

### "Database connection failed"

**Check:**
- `POSTGRES_PASSWORD` is set correctly in Portainer
- Database service is healthy: `docker exec atlas-postgres pg_isready`
- Services can reach database: `docker exec atlas-cyclist-profile ping postgres`

### "Webhook not triggering"

**Check:**
- `PORTAINER_WEBHOOK_ATLAS` secret exists in GitHub
- Webhook URL is correct (copy from Portainer)
- Webhook is enabled in Portainer
- Portainer is accessible from GitHub Actions

### "Service won't start"

**Check:**
- All required variables are set
- Port is not already in use
- Image exists in GHCR
- Check logs: `docker logs atlas-cyclist-profile`

---

## 📚 Additional Resources

- **Stack template:** `deployment/portainer/atlas-stack.yml`
- **Setup guide:** `deployment/SINGLE_STACK_SETUP.md`
- **Main deployment guide:** `deployment/README.md`
- **Troubleshooting:** `deployment/portainer/README.md`

---

## ✅ Checklist

Before deploying, verify:

- [ ] `POSTGRES_PASSWORD` set in Portainer (strong password)
- [ ] `PORTAINER_WEBHOOK_ATLAS` set in GitHub secrets
- [ ] Webhook enabled in Portainer
- [ ] All optional variables reviewed (using defaults or custom values)
- [ ] Security best practices followed

---

**You're ready to deploy! 🚀**

