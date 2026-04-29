# Preview Environments Implementation Guide

## 🎯 Overview

Preview environments provide isolated, temporary deployments for every pull request, enabling teams to test changes in production-like environments before merging.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Pull Request  │    │   GitHub        │    │   Preview       │
│   Created       │───►│   Actions       │───►│   Environment   │
│                 │    │                 │    │   (Kubernetes)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PR Comment    │◄───│   Deployment    │◄───│   Health Check  │
│   with URL      │    │   Status        │    │   & Tests       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Implementation Options

### Option 1: Kubernetes + ArgoCD (Recommended)
**Pros**: Production-like, GitOps native, scalable  
**Cons**: Complex setup, requires K8s knowledge  
**Cost**: $20-50/month for cluster + resources  

### Option 2: Docker Compose + VPS
**Pros**: Simple, cost-effective, easy to understand  
**Cons**: Not production-like, limited scalability  
**Cost**: $10-20/month per VPS  

### Option 3: Cloud Platform (Vercel/Netlify)
**Pros**: Zero maintenance, fast deployment  
**Cons**: Limited to frontend apps, vendor lock-in  
**Cost**: Free tier available, $20+/month for teams  

## 🎯 Option 1: Kubernetes + ArgoCD Implementation

### Prerequisites
- [ ] Kubernetes cluster (EKS, GKE, DigitalOcean, or local)
- [ ] ArgoCD installed and configured
- [ ] Ingress controller (nginx, traefik)
- [ ] DNS wildcard domain (*.preview.yourdomain.com)

### Step 1: Namespace Strategy
```yaml
# Each PR gets its own namespace
apiVersion: v1
kind: Namespace
metadata:
  name: atlas-pr-${PR_NUMBER}
  labels:
    app: atlas
    type: preview
    pr-number: "${PR_NUMBER}"
    created-by: github-actions
```

### Step 2: Helm Chart for Preview Deployments
```yaml
# helm/preview/Chart.yaml
apiVersion: v2
name: atlas-preview
description: Atlas Preview Environment
version: 0.1.0
appVersion: "1.0"

# helm/preview/values.yaml
global:
  prNumber: ""
  gitSha: ""
  apps: []

ingress:
  enabled: true
  className: nginx
  host: "pr-${PR_NUMBER}.preview.yourdomain.com"
  
database:
  enabled: true
  # Use lightweight postgres for previews
  image: postgres:15-alpine
  storage: 1Gi

apps:
  docs:
    enabled: false
    image: ""
    port: 3000
  
  cyclist-profile:
    enabled: false
    image: ""
    port: 3000
```

### Step 3: GitHub Actions Workflow
```yaml
# .github/workflows/preview-deploy.yml
name: Deploy Preview Environment

on:
  pull_request:
    types: [opened, synchronize, reopened]
    branches: [main]

permissions:
  contents: read
  pull-requests: write
  deployments: write

jobs:
  detect-changes:
    # ... (same as existing change detection)

  deploy-preview:
    needs: detect-changes
    if: needs.detect-changes.outputs.has_changes == 'true'
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup environment variables
        run: |
          echo "PR_NUMBER=${{ github.event.number }}" >> $GITHUB_ENV
          echo "GIT_SHA=${{ github.sha }}" >> $GITHUB_ENV
          echo "PREVIEW_URL=https://pr-${{ github.event.number }}.preview.yourdomain.com" >> $GITHUB_ENV

      - name: Build and push images
        run: |
          # Build only changed apps
          CHANGED_APPS='${{ needs.detect-changes.outputs.matrix }}'
          for app in $(echo $CHANGED_APPS | jq -r '.[]'); do
            echo "Building $app..."
            docker build -f apps/$app/Dockerfile \
              -t ghcr.io/ameciclo/atlas/$app:pr-$PR_NUMBER \
              .
            docker push ghcr.io/ameciclo/atlas/$app:pr-$PR_NUMBER
          done

      - name: Generate preview values
        run: |
          cat > preview-values.yaml << EOF
          global:
            prNumber: "$PR_NUMBER"
            gitSha: "$GIT_SHA"
            apps: ${{ needs.detect-changes.outputs.matrix }}

          ingress:
            host: "pr-$PR_NUMBER.preview.yourdomain.com"

          $(echo '${{ needs.detect-changes.outputs.matrix }}' | jq -r '.[] | "apps." + . + ".enabled: true\napps." + . + ".image: ghcr.io/ameciclo/atlas/" + . + ":pr-${{ github.event.number }}"')
          EOF

      - name: Deploy to Kubernetes
        run: |
          # Create namespace
          kubectl create namespace atlas-pr-$PR_NUMBER --dry-run=client -o yaml | kubectl apply -f -
          
          # Deploy with Helm
          helm upgrade --install atlas-pr-$PR_NUMBER ./helm/preview \
            --namespace atlas-pr-$PR_NUMBER \
            --values preview-values.yaml \
            --wait --timeout=10m

      - name: Wait for deployment
        run: |
          kubectl wait --for=condition=available \
            --timeout=300s \
            deployment -l app.kubernetes.io/instance=atlas-pr-$PR_NUMBER \
            -n atlas-pr-$PR_NUMBER

      - name: Run health checks
        run: |
          # Wait for ingress to be ready
          sleep 30
          
          # Check if preview environment is accessible
          curl -f $PREVIEW_URL/health || exit 1

      - name: Create deployment status
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.repos.createDeploymentStatus({
              owner: context.repo.owner,
              repo: context.repo.repo,
              deployment_id: context.payload.deployment?.id,
              state: 'success',
              environment_url: '${{ env.PREVIEW_URL }}',
              description: 'Preview environment deployed successfully'
            });

      - name: Comment on PR
        uses: actions/github-script@v7
        with:
          script: |
            const { data: comments } = await github.rest.issues.listComments({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
            });

            const botComment = comments.find(comment => 
              comment.user.type === 'Bot' && 
              comment.body.includes('Preview Environment')
            );

            const body = `## 🚀 Preview Environment Deployed

            **URL**: ${{ env.PREVIEW_URL }}
            **Apps**: ${{ needs.detect-changes.outputs.matrix }}
            **Commit**: \`${{ github.sha }}\`

            ### 🔗 Quick Links
            - [📚 Documentation](${{ env.PREVIEW_URL }}/docs)
            - [🔍 Health Check](${{ env.PREVIEW_URL }}/health)
            - [📊 Metrics](${{ env.PREVIEW_URL }}/metrics)

            ### 🧪 Testing
            This preview environment includes only the changed applications. Test your changes and verify they work as expected.

            ---
            *This comment will be updated on new commits*`;

            if (botComment) {
              await github.rest.issues.updateComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                comment_id: botComment.id,
                body: body
              });
            } else {
              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.issue.number,
                body: body
              });
            }
```

### Step 4: Cleanup Workflow
```yaml
# .github/workflows/preview-cleanup.yml
name: Cleanup Preview Environment

on:
  pull_request:
    types: [closed]

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Delete preview environment
        run: |
          PR_NUMBER=${{ github.event.number }}
          
          # Delete Helm release
          helm uninstall atlas-pr-$PR_NUMBER \
            --namespace atlas-pr-$PR_NUMBER || true
          
          # Delete namespace
          kubectl delete namespace atlas-pr-$PR_NUMBER || true
          
          # Delete Docker images
          CHANGED_APPS=$(gh api repos/${{ github.repository }}/pulls/$PR_NUMBER/files \
            --jq '[.[] | select(.filename | startswith("apps/")) | .filename | split("/")[1]] | unique')
          
          for app in $(echo $CHANGED_APPS | jq -r '.[]'); do
            gh api --method DELETE \
              /orgs/${{ github.repository_owner }}/packages/container/atlas%2F$app/versions \
              --field package_version_id=$(gh api /orgs/${{ github.repository_owner }}/packages/container/atlas%2F$app/versions \
                --jq ".[] | select(.metadata.container.tags[] | contains(\"pr-$PR_NUMBER\")) | .id") || true
          done

      - name: Update PR comment
        uses: actions/github-script@v7
        with:
          script: |
            const { data: comments } = await github.rest.issues.listComments({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
            });

            const botComment = comments.find(comment => 
              comment.user.type === 'Bot' && 
              comment.body.includes('Preview Environment')
            );

            if (botComment) {
              await github.rest.issues.updateComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                comment_id: botComment.id,
                body: `## 🗑️ Preview Environment Cleaned Up

                The preview environment for this PR has been automatically cleaned up.

                **Cleaned up resources:**
                - Kubernetes namespace: \`atlas-pr-${{ github.event.number }}\`
                - Docker images with tag: \`pr-${{ github.event.number }}\`
                - Helm release: \`atlas-pr-${{ github.event.number }}\`

                ---
                *Cleanup completed automatically when PR was closed*`
              });
            }
```

## 📋 Implementation Checklist

### Week 1: Infrastructure Setup
- [ ] Set up Kubernetes cluster
- [ ] Install ArgoCD and ingress controller
- [ ] Configure DNS wildcard domain
- [ ] Set up container registry access
- [ ] Create preview Helm chart

### Week 2: CI/CD Integration
- [ ] Create preview deployment workflow
- [ ] Add cleanup workflow
- [ ] Configure GitHub secrets and permissions
- [ ] Test with sample PR
- [ ] Add health checks and monitoring

### Week 3: Enhancement and Testing
- [ ] Add database seeding for previews
- [ ] Implement resource limits and quotas
- [ ] Add automated testing in preview environments
- [ ] Create documentation for team
- [ ] Set up cost monitoring

### Week 4: Production Rollout
- [ ] Test with multiple concurrent PRs
- [ ] Monitor resource usage and costs
- [ ] Train team on preview environment usage
- [ ] Set up alerting for failed deployments
- [ ] Document troubleshooting procedures

## 💰 Cost Management

### Resource Limits
```yaml
# Helm values for resource limits
resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 128Mi

# Namespace resource quota
apiVersion: v1
kind: ResourceQuota
metadata:
  name: preview-quota
spec:
  hard:
    requests.cpu: "2"
    requests.memory: 4Gi
    limits.cpu: "4"
    limits.memory: 8Gi
    persistentvolumeclaims: "3"
```

### Auto-cleanup Policies
- [ ] Delete environments after 7 days of inactivity
- [ ] Limit maximum number of concurrent preview environments
- [ ] Use spot instances for cost savings
- [ ] Monitor and alert on cost thresholds

## 🎯 Success Criteria

- [ ] **<5 minute deployment time** for preview environments
- [ ] **99% deployment success rate**
- [ ] **Automatic cleanup** of closed PRs
- [ ] **<$100/month** total cost for preview environments
- [ ] **90%+ team adoption** for testing changes

## 📚 Additional Resources

- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)
- [Kubernetes Preview Environments](https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/)
- [Helm Charts Best Practices](https://helm.sh/docs/chart_best_practices/)
- [GitHub Deployments API](https://docs.github.com/en/rest/deployments)
