# Docs Service Configuration Fix

## Problem

The original `atlas-stack-kong.yml` had incorrect configuration for the docs service, which prevented it from running successfully in Portainer.

## Root Cause

The docs service is a **static React app served by nginx**, not a Node.js application. The original stack file had configuration meant for a Node.js app.

## Key Differences

### Docs Service Architecture
- **Runtime**: Nginx (Alpine Linux)
- **Port**: Always port 80 (hardcoded in nginx.conf, not configurable via environment variables)
- **Healthcheck**: Uses `wget` command (available in Alpine Linux)
- **No Node.js**: The container doesn't have Node.js installed

### Cyclist Profile Service Architecture
- **Runtime**: Node.js
- **Port**: Configurable via PORT environment variable (default: 3000)
- **Healthcheck**: Uses `node` command with HTTP request
- **Has Node.js**: Full Node.js runtime available

## Changes Made

### 1. Fixed Healthcheck Command

**Before (WRONG):**
```yaml
healthcheck:
  test:
    [
      "CMD",
      "wget",
      "--quiet",              # ❌ Wrong flag
      "--tries=1",
      "--spider",
      "http://localhost:80/index.html",  # ❌ Wrong path
    ]
```

**After (CORRECT):**
```yaml
healthcheck:
  test:
    [
      "CMD",
      "wget",
      "--no-verbose",         # ✅ Correct flag for Alpine wget
      "--tries=1",
      "--spider",
      "http://localhost/",    # ✅ Correct path (nginx serves index.html by default)
    ]
```

### 2. Updated Comments

**Added clarification:**
```yaml
# ============================================================================
# Documentation Service - Static React App
# ============================================================================
# Serves static React documentation via Nginx on port 80
docs:
  # Expose port internally to Kong network only (no host port binding)
  # Nginx listens on port 80 (hardcoded in nginx.conf)
  expose:
    - "80"
```

### 3. Fixed Kong Route Documentation

**Before:**
```yaml
#   Documentation:
#     Service: http://atlas-docs:3001  # ❌ Wrong port
#     Route: /docs
```

**After:**
```yaml
#   Documentation (nginx static site):
#     Service: http://atlas-docs:80    # ✅ Correct port
#     Route: /docs
```

### 4. Updated Health Check Documentation

**Before:**
```yaml
# Health Checks:
#   Docs:  curl http://atlas-docs:3001/  # ❌ Wrong port
```

**After:**
```yaml
# Health Checks:
#   Docs:  curl http://atlas-docs/       # ✅ Correct (port 80 is default)
```

### 5. Added Note About Port Configuration

**Added to header:**
```yaml
# Note: Docs app uses nginx and always listens on port 80 (not configurable)
```

## Why These Changes Matter

### 1. Healthcheck Failure
The original healthcheck would fail because:
- `wget --quiet` doesn't work the same way as `wget --no-verbose` in Alpine Linux
- Checking `/index.html` directly is unnecessary; nginx serves it at `/` by default
- This would cause Portainer to mark the container as unhealthy

### 2. Kong Routing Issues
If Kong was configured to route to port 3001, it would fail because:
- Nginx only listens on port 80
- There's no service running on port 3001 in the docs container

### 3. Confusion About Architecture
Without clear comments, developers might:
- Try to set PORT environment variable (which does nothing)
- Expect Node.js to be available (it's not)
- Try to use Node.js-based healthchecks (which fail)

## How to Use the Fixed Stack

1. **Replace the old stack file** with `atlas-stack-kong-fixed.yml`
2. **Update Kong routes** to point to `http://atlas-docs:80` (not port 3001)
3. **Deploy the stack** in Portainer
4. **Verify healthcheck** passes after ~20 seconds (start_period)

## Testing the Fix Locally

You can test the docs service locally with Docker:

```bash
# Build the image
docker build -t atlas-docs -f apps/docs/Dockerfile .

# Run the container
docker run -d --name test-docs -p 8081:80 atlas-docs

# Test the healthcheck
docker exec test-docs wget --no-verbose --tries=1 --spider http://localhost/

# Access the docs
curl http://localhost:8081/

# Cleanup
docker stop test-docs && docker rm test-docs
```

## Related Files

- `apps/docs/Dockerfile` - Multi-stage build that creates the nginx container
- `apps/docs/nginx.conf` - Nginx configuration (hardcodes port 80)
- `deployment/portainer/atlas-stack-kong.yml` - Original (correct) stack file
- `deployment/portainer/atlas-stack-kong-fixed.yml` - Fixed version of the stack you provided

## Summary

The docs service is fundamentally different from the API services:
- It's a **static site** served by **nginx**, not a Node.js app
- It always runs on **port 80** (not configurable)
- Healthchecks must use **wget** (not node)
- Kong routes must point to **port 80** (not 3001)

The fixed stack file now correctly reflects this architecture.

