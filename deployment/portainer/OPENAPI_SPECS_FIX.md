# OpenAPI Specs Missing in Docs Docker Image - Fix

## Problem

When deploying the docs service via Docker/Portainer, the documentation shows:

```
Error Loading API Documentation
No OpenAPI specs found. Make sure API services have generated their specs.
```

## Root Cause

The Docker build workflow (`.github/workflows/docker.yml`) was not generating OpenAPI specs from other services when building the **docs** Docker image.

### What Was Happening:

1. **Docs app is built** → Docker workflow triggers
2. **OpenAPI generation step** → Only checks if the **docs** app has `generate-openapi.ts`
3. **Docs app doesn't generate specs** → It only displays specs from other services
4. **Docker image is built** → Without the cyclist-profile OpenAPI spec
5. **Result** → Empty docs with "No OpenAPI specs found" error

### The Workflow Logic Issue:

**Before (WRONG):**
```yaml
- name: Generate OpenAPI specs
  run: |
    # Only generates spec if THIS app has generate-openapi.ts
    if [ -f "apps/${{ matrix.app }}/src/generate-openapi.ts" ]; then
      pnpm --filter @atlas/${{ matrix.app }} generate-openapi
    fi
```

This meant:
- ✅ Building `cyclist-profile` → Generates cyclist-profile OpenAPI spec
- ❌ Building `docs` → Doesn't generate any specs (docs doesn't have generate-openapi.ts)

## Solution

Updated the Docker workflow to:
1. **Detect when building docs app**
2. **Generate ALL OpenAPI specs** from all services before building docs
3. **Include specs in the Docker image**

### What Changed:

**After (CORRECT):**
```yaml
- name: Generate all OpenAPI specs for docs
  if: matrix.app == 'docs'
  run: |
    # Generate OpenAPI for ALL services
    for app_dir in apps/*/; do
      app_name=$(basename "$app_dir")
      if [ -f "apps/$app_name/src/generate-openapi.ts" ]; then
        pnpm --filter @atlas/$app_name generate-openapi
      fi
    done
```

Now when building docs:
1. ✅ Sets up PostgreSQL database
2. ✅ Runs database migrations
3. ✅ Generates OpenAPI specs for **all services** (cyclist-profile, etc.)
4. ✅ Builds docs Docker image with all specs included
5. ✅ Docs display correctly with all API documentation

## Files Changed

### `.github/workflows/docker.yml`

**Changes:**
1. Added PostgreSQL setup for docs build (needed for OpenAPI generation)
2. Added database migration step for docs build
3. Added loop to generate OpenAPI specs for all services when building docs
4. Kept existing logic for other apps unchanged

**Key sections:**
- Lines 108-159: New OpenAPI generation logic
  - Conditional setup for Node.js/pnpm
  - PostgreSQL setup (only for docs)
  - Database migrations (only for docs)
  - Generate all specs (only for docs)
  - Generate single spec (for other apps)

## Testing the Fix

### Local Testing

To test the fix locally before pushing:

```bash
# 1. Generate OpenAPI specs
pnpm turbo run generate-openapi

# 2. Build the docs Docker image
docker build -t atlas-docs-test -f apps/docs/Dockerfile .

# 3. Run the container
docker run -d --name docs-test -p 8081:80 atlas-docs-test

# 4. Check if specs are included
docker exec docs-test ls -la /usr/share/nginx/html/openapi/

# Expected output:
# cyclist-profile.json
# index.json

# 5. Access the docs
curl http://localhost:8081/

# 6. Cleanup
docker stop docs-test && docker rm docs-test
```

### CI/CD Testing

After pushing the changes:

1. **Push to a branch** and create a PR
2. **GitHub Actions will run** the Docker build workflow
3. **Check the logs** for the "Generate all OpenAPI specs for docs" step
4. **Verify** it generates specs for cyclist-profile
5. **Merge to main** to build and push the image
6. **Pull the new image** in Portainer: `ghcr.io/ameciclo/atlas/docs:latest`
7. **Redeploy** the docs service
8. **Verify** the documentation loads correctly

## Deployment Steps

### For Immediate Fix (Manual)

If you need the docs working NOW before the CI/CD fix is deployed:

1. **Generate specs locally:**
   ```bash
   pnpm turbo run generate-openapi
   ```

2. **Build and push manually:**
   ```bash
   # Build the image
   docker build -t ghcr.io/ameciclo/atlas/docs:manual-fix -f apps/docs/Dockerfile .
   
   # Login to GitHub Container Registry
   echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
   
   # Push the image
   docker push ghcr.io/ameciclo/atlas/docs:manual-fix
   ```

3. **Update Portainer stack** to use the manual-fix tag:
   ```yaml
   docs:
     image: ghcr.io/ameciclo/atlas/docs:manual-fix
   ```

### For Permanent Fix (CI/CD)

1. **Commit the workflow changes:**
   ```bash
   git add .github/workflows/docker.yml
   git commit -m "fix(ci): generate all OpenAPI specs when building docs image"
   git push
   ```

2. **Wait for CI/CD** to build and push the new image

3. **Update Portainer** to pull the latest image:
   - Go to Stacks → atlas
   - Click "Pull and redeploy"
   - Or manually pull: `docker pull ghcr.io/ameciclo/atlas/docs:latest`

4. **Verify** the docs load correctly

## Why This Matters

### The Docs App Architecture

The docs app is a **static React app** that:
- Displays OpenAPI specifications using Scalar
- Doesn't generate its own specs
- Relies on specs from other services (cyclist-profile, etc.)
- Needs all specs to be present at **build time**

### The Build Process

```
┌─────────────────────────────────────────────────────────────┐
│ Docker Build Process (Before Fix)                          │
├─────────────────────────────────────────────────────────────┤
│ 1. Checkout code                                           │
│ 2. Check if docs has generate-openapi.ts → NO              │
│ 3. Skip OpenAPI generation                                 │
│ 4. Copy apps/docs/public/openapi → Empty or outdated       │
│ 5. Build React app                                         │
│ 6. Result: Docs with no/outdated specs ❌                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Docker Build Process (After Fix)                           │
├─────────────────────────────────────────────────────────────┤
│ 1. Checkout code                                           │
│ 2. Detect building docs app → YES                          │
│ 3. Setup PostgreSQL                                        │
│ 4. Run database migrations                                 │
│ 5. Generate ALL OpenAPI specs (cyclist-profile, etc.)      │
│ 6. Copy apps/docs/public/openapi → Fresh specs ✅          │
│ 7. Build React app                                         │
│ 8. Result: Docs with all current specs ✅                  │
└─────────────────────────────────────────────────────────────┘
```

## Related Files

- `.github/workflows/docker.yml` - Docker build workflow (FIXED)
- `.github/workflows/ci.yml` - CI workflow with OpenAPI generation
- `apps/docs/Dockerfile` - Docs Docker build (copies OpenAPI specs)
- `apps/docs/public/openapi/` - OpenAPI specs directory
- `apps/cyclist-profile/src/generate-openapi.ts` - Generates cyclist-profile spec

## Summary

**Problem:** Docs Docker image built without OpenAPI specs
**Cause:** Workflow only generated specs for the app being built
**Solution:** Generate all service specs when building docs
**Result:** Docs now display all API documentation correctly ✅

