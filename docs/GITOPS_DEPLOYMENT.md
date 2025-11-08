# GitOps Deployment Guide

This document explains how the Atlas documentation is automatically deployed using GitOps principles with ArgoCD.

## Overview

The deployment follows a GitOps approach where:
1. **Atlas Repository**: Contains the application code and CI/CD workflows
2. **Groundwork Repository**: Contains Kubernetes manifests and serves as the "source of truth"
3. **ArgoCD**: Monitors the groundwork repository and automatically deploys changes

## Workflow

### Automatic Staging Deployment

```mermaid
graph LR
    A[Push to main] --> B[CI/CD Tests]
    B --> C[Build Docker Image]
    C --> D[Push to GHCR]
    D --> E[Update Staging Manifest]
    E --> F[ArgoCD Sync]
    F --> G[Staging Deployed]
```

**Triggers**: Every push to `main` branch
**Target**: `docs-staging.ameciclo.org`
**Image Tag**: `latest`

### Release-based Production Deployment

```mermaid
graph LR
    A[Create Release] --> B[Build Versioned Images]
    B --> C[Update Prod Manifest]
    C --> D[ArgoCD Sync]
    D --> E[Production Deployed]
```

**Triggers**: Semantic release (conventional commits)
**Target**: `docs.ameciclo.org`
**Image Tag**: Semantic version (e.g., `1.2.3`)

### Manual Production Deployment

```mermaid
graph LR
    A[Manual Trigger] --> B[Validate Version]
    B --> C[Update Prod Manifest]
    C --> D[ArgoCD Sync]
    D --> E[Production Deployed]
```

**Triggers**: Manual workflow dispatch
**Target**: `docs.ameciclo.org`
**Image Tag**: User-specified version

## Deployment Environments

### Staging Environment
- **Namespace**: `atlas-staging`
- **URL**: `docs-staging.ameciclo.org`
- **Auto-deploy**: ✅ Every main branch build
- **Image**: `ghcr.io/ameciclo/atlas/docs:latest`

### Production Environment
- **Namespace**: `atlas-production`
- **URL**: `docs.ameciclo.org`
- **Auto-deploy**: ✅ On semantic releases
- **Manual deploy**: ✅ Via GitHub Actions
- **Image**: `ghcr.io/ameciclo/atlas/docs:x.y.z`

## How to Deploy

### Staging (Automatic)
1. Push changes to `main` branch
2. CI/CD will automatically build and deploy to staging
3. Check `docs-staging.ameciclo.org`

### Production (via Release)
1. Use conventional commits (e.g., `feat: add new feature`)
2. Push to `main` branch
3. Release Please will create a release PR
4. Merge the release PR
5. Production will be automatically updated

### Production (Manual)
1. Go to GitHub Actions → "Deploy to Production"
2. Click "Run workflow"
3. Enter the version to deploy (e.g., `1.2.3`)
4. Type `DEPLOY` to confirm
5. Click "Run workflow"

## Monitoring

### ArgoCD Dashboard
- Monitor application health and sync status
- View deployment history
- Manual sync if needed

### Deployment Logs
Check the deployment log in the groundwork repository:
- File: `.github/deployment-log.md`
- Contains timestamped deployment history

### Application Logs
```bash
# Staging
kubectl logs -n atlas-staging -l app.kubernetes.io/name=atlas-docs

# Production
kubectl logs -n atlas-production -l app.kubernetes.io/name=atlas-docs
```

## Rollback

### Via ArgoCD UI
1. Open ArgoCD dashboard
2. Select the application
3. Go to "History and Rollback"
4. Select previous version and rollback

### Via Manual Deployment
1. Use "Deploy to Production" workflow
2. Specify the previous working version
3. Confirm deployment

## Troubleshooting

### Deployment Stuck
- Check ArgoCD application status
- Verify image exists in GHCR
- Check Kubernetes events: `kubectl get events -n atlas-[staging|production]`

### Image Not Found
- Ensure the version was properly released
- Check GHCR: `https://github.com/ameciclo/atlas/pkgs/container/atlas%2Fdocs`
- Verify CI/CD completed successfully

### ArgoCD Not Syncing
- Check ArgoCD application configuration
- Verify repository access
- Manual sync via ArgoCD UI
