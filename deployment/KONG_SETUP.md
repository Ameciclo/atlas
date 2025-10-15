# Atlas Deployment with Kong Gateway

This guide explains how to deploy Atlas services integrated with Kong Gateway for API management, routing, and authentication.

---

## 🎯 Overview

### Architecture

```
Internet
    ↓
Kong Gateway (kong-gateway_kong-net)
    ↓
    ├─→ /api/cyclist-profile → atlas-cyclist-profile:3000 (Hono API)
    └─→ /docs → atlas-docs:80 (nginx static site)
```

**Benefits:**
- ✅ Centralized API gateway for all services
- ✅ Authentication and authorization via Kong
- ✅ Rate limiting and traffic control
- ✅ SSL/TLS termination at Kong
- ✅ Service discovery and load balancing
- ✅ No direct port exposure to host

---

## 📋 Prerequisites

### 1. Kong Gateway Running

Verify Kong is running and network exists:

```bash
# Check Kong network exists
docker network ls | grep kong-gateway_kong-net

# Should output:
# <network-id>   kong-gateway_kong-net   bridge    local
```

If the network doesn't exist, Kong Gateway is not running. Start Kong first.

### 2. Managed PostgreSQL Database

You need a managed PostgreSQL database (e.g., Digital Ocean, AWS RDS, etc.) with:
- PostgreSQL 16+ with PostGIS extension
- Network accessible from your Portainer host
- Database name: `atlas`
- User with full permissions

### 3. GitHub Container Registry Access

Ensure Portainer can pull images from GitHub Container Registry:

```bash
# Test image pull
docker pull ghcr.io/ameciclo/atlas/cyclist-profile:latest
docker pull ghcr.io/ameciclo/atlas/docs:latest
```

If authentication is required, configure registry credentials in Portainer.

---

## 🚀 Deployment Steps

### Step 1: Prepare Database Connection String

Get your managed database connection string:

```bash
# Format:
DATABASE_URL=postgresql://username:password@host:port/atlas

# Example (Digital Ocean):
DATABASE_URL=postgresql://doadmin:AVNS_abc123@db-postgresql-nyc3-12345.ondigitalocean.com:25060/atlas?sslmode=require

# Example (AWS RDS):
DATABASE_URL=postgresql://postgres:mypassword@atlas-db.abc123.us-east-1.rds.amazonaws.com:5432/atlas
```

**Important:** Keep this secure! Never commit it to Git.

### Step 2: Deploy Stack in Portainer

1. **Login to Portainer**
2. **Go to:** Stacks → Add stack
3. **Name:** `atlas`
4. **Build method:** Web editor or Git repository
5. **Stack file:** Copy content from `deployment/portainer/atlas-stack-kong.yml`
6. **Environment variables:**
   ```bash
   DATABASE_URL=postgresql://user:password@host:port/atlas
   ```
7. **Click:** "Deploy the stack"

### Step 3: Verify Services Are Running

```bash
# Check containers
docker ps | grep atlas

# Should see:
# atlas-cyclist-profile-migrate (exited - this is normal)
# atlas-cyclist-profile (running)
# atlas-docs (running)

# Check health
docker exec atlas-cyclist-profile node -e "require('http').get('http://localhost:3000/health', (r) => console.log(r.statusCode))"
# Should output: 200

docker exec atlas-docs wget --spider -q http://localhost/ && echo "200" || echo "Failed"
# Should output: 200
```

### Step 4: Configure Kong Routes

Now configure Kong to route traffic to your Atlas services.

#### Option A: Using Kong Admin API

**Create Cyclist Profile Service:**

```bash
curl -i -X POST http://localhost:8001/services \
  --data name=atlas-cyclist-profile \
  --data url='http://atlas-cyclist-profile:3000'
```

**Create Route for Cyclist Profile:**

```bash
curl -i -X POST http://localhost:8001/services/atlas-cyclist-profile/routes \
  --data 'paths[]=/api/cyclist-profile' \
  --data name=cyclist-profile-route
```

**Create Docs Service:**

```bash
curl -i -X POST http://localhost:8001/services \
  --data name=atlas-docs \
  --data url='http://atlas-docs:80'
```

**Create Route for Docs:**

```bash
curl -i -X POST http://localhost:8001/services/atlas-docs/routes \
  --data 'paths[]=/docs' \
  --data name=docs-route
```

#### Option B: Using Kong Manager (GUI)

If you have Kong Manager (Enterprise) or Konga:

**Cyclist Profile Service:**
1. Go to Services → Add New Service
2. Name: `atlas-cyclist-profile`
3. URL: `http://atlas-cyclist-profile:3000`
4. Save

**Cyclist Profile Route:**
1. Go to Routes → Add New Route
2. Service: `atlas-cyclist-profile`
3. Paths: `/api/cyclist-profile`
4. Name: `cyclist-profile-route`
5. Save

**Docs Service:**
1. Go to Services → Add New Service
2. Name: `atlas-docs`
3. URL: `http://atlas-docs:80`
4. Save

**Docs Route:**
1. Go to Routes → Add New Route
2. Service: `atlas-docs`
3. Paths: `/docs`
4. Name: `docs-route`
5. Save

### Step 5: Test Kong Routes

```bash
# Test Cyclist Profile API through Kong
curl http://localhost:8000/api/cyclist-profile/health
# Should return: {"status":"ok"}

# Test Docs through Kong
curl http://localhost:8000/docs/
# Should return: HTML content
```

### Step 6: Enable Service Webhooks

For automated deployments, enable webhooks for each service:

**Cyclist Profile:**
1. In Portainer: Containers → atlas-cyclist-profile
2. Click "Duplicate/Edit"
3. Scroll to "Webhook" section
4. Enable webhook
5. Copy webhook URL
6. Add to GitHub secrets as `PORTAINER_WEBHOOK_CYCLIST_PROFILE`

**Docs:**
1. In Portainer: Containers → atlas-docs
2. Click "Duplicate/Edit"
3. Scroll to "Webhook" section
4. Enable webhook
5. Copy webhook URL
6. Add to GitHub secrets as `PORTAINER_WEBHOOK_DOCS`

---

## 🔒 Security Configuration (Optional)

### Add Authentication to Routes

**Enable Key Authentication:**

```bash
# Enable key-auth plugin on cyclist-profile service
curl -i -X POST http://localhost:8001/services/atlas-cyclist-profile/plugins \
  --data name=key-auth

# Create a consumer
curl -i -X POST http://localhost:8001/consumers \
  --data username=api-client

# Create API key for consumer
curl -i -X POST http://localhost:8001/consumers/api-client/key-auth \
  --data key=my-secret-api-key
```

**Test with authentication:**

```bash
# Without key (should fail)
curl http://localhost:8000/api/cyclist-profile/health

# With key (should succeed)
curl -H "apikey: my-secret-api-key" http://localhost:8000/api/cyclist-profile/health
```

### Add Rate Limiting

```bash
# Limit to 100 requests per minute
curl -i -X POST http://localhost:8001/services/atlas-cyclist-profile/plugins \
  --data name=rate-limiting \
  --data config.minute=100 \
  --data config.policy=local
```

---

## 📊 Environment Variables Reference

### Required in Portainer

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | ✅ Yes | PostgreSQL connection string | `postgresql://user:pass@host:5432/atlas` |

### Optional in Portainer

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CYCLIST_PROFILE_PORT` | No | `3000` | Internal port for cyclist-profile |
| `LOG_LEVEL` | No | `info` | Logging level (debug, info, warn, error) |
| `IMAGE_TAG` | No | `latest` | Docker image tag |

**Note:** Docs app uses nginx and always listens on port 80 (not configurable via environment variable).

### Required in GitHub Secrets

| Secret | Required | Description |
|--------|----------|-------------|
| `PORTAINER_WEBHOOK_CYCLIST_PROFILE` | ✅ Yes | Webhook URL for cyclist-profile service |
| `PORTAINER_WEBHOOK_DOCS` | ✅ Yes | Webhook URL for docs service |

---

## ✅ Deployment Checklist

### Portainer Setup
- [ ] Kong Gateway running with `kong-gateway_kong-net` network
- [ ] Managed PostgreSQL database accessible
- [ ] DATABASE_URL connection string ready
- [ ] Stack `atlas` deployed in Portainer
- [ ] All services running (cyclist-profile, docs)
- [ ] Health checks passing
- [ ] Webhooks enabled for both services
- [ ] Webhook URLs copied

### Kong Configuration
- [ ] Service `atlas-cyclist-profile` created in Kong
- [ ] Route `/api/cyclist-profile` configured
- [ ] Service `atlas-docs` created in Kong
- [ ] Route `/docs` configured
- [ ] Routes tested and working
- [ ] (Optional) Authentication configured
- [ ] (Optional) Rate limiting configured

### GitHub Setup
- [ ] Secret `PORTAINER_WEBHOOK_CYCLIST_PROFILE` added
- [ ] Secret `PORTAINER_WEBHOOK_DOCS` added
- [ ] Deploy workflow configured
- [ ] Test deployment by pushing a change

---

## 🔄 How Deployments Work

### Scenario: You Update Cyclist Profile API

```
1. Developer pushes code
   └─ git push origin main

2. GitHub Actions - CI
   └─ Run tests, build, type-check

3. GitHub Actions - Docker
   └─ Build image: ghcr.io/ameciclo/atlas/cyclist-profile:latest
   └─ Push to GHCR

4. GitHub Actions - Deploy
   └─ POST to PORTAINER_WEBHOOK_CYCLIST_PROFILE

5. Portainer
   └─ Pull latest image
   └─ Restart atlas-cyclist-profile container
   └─ Run migrations (cyclist-profile-migrate)
   └─ Health check passes

6. Kong Gateway
   └─ Automatically routes traffic to updated service
   └─ No Kong configuration changes needed

7. Result
   └─ API updated with zero downtime
   └─ Total time: ~3-5 minutes
```

---

## 🚨 Troubleshooting

### Services Can't Connect to Database

```bash
# Check DATABASE_URL is set correctly
docker exec atlas-cyclist-profile env | grep DATABASE_URL

# Test database connection
docker exec atlas-cyclist-profile node -e "const pg = require('pg'); const client = new pg.Client(process.env.DATABASE_URL); client.connect().then(() => console.log('Connected!')).catch(e => console.error(e))"
```

### Kong Can't Reach Services

```bash
# Verify services are on Kong network
docker inspect atlas-cyclist-profile | grep kong-gateway_kong-net

# Test from Kong container
docker exec <kong-container-id> curl http://atlas-cyclist-profile:3000/health
```

### Webhook Not Triggering

```bash
# Check webhook URL is correct
# Should look like: https://portainer.example.com/api/webhooks/abc123-def456

# Test webhook manually
curl -X POST "https://portainer.example.com/api/webhooks/abc123-def456"
```

---

## 📚 Additional Resources

- **Stack file:** `deployment/portainer/atlas-stack-kong.yml`
- **Deploy workflow:** `.github/workflows/deploy.yml`
- **Kong documentation:** https://docs.konghq.com/
- **Main deployment guide:** `deployment/README.md`

---

**Your Atlas services are now integrated with Kong Gateway! 🚀**

