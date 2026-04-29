# Deployment Verification Implementation Guide

## 🎯 Overview

Implement automated deployment verification to ensure applications are healthy and functioning correctly after deployment, with automatic rollback capabilities for failed deployments.

## 🔍 Verification Components

### 1. Health Checks
- [ ] HTTP endpoint health verification
- [ ] Database connectivity checks
- [ ] External service dependency verification
- [ ] Resource utilization monitoring

### 2. Smoke Tests
- [ ] Critical user journey testing
- [ ] API endpoint functionality verification
- [ ] Authentication and authorization checks
- [ ] Data integrity validation

### 3. Performance Verification
- [ ] Response time monitoring
- [ ] Throughput verification
- [ ] Resource usage validation
- [ ] Error rate monitoring

### 4. Rollback Automation
- [ ] Automatic rollback on health check failures
- [ ] Manual rollback triggers
- [ ] Rollback verification
- [ ] Incident notification

## 🚀 Implementation Plan

### Phase 1: Basic Health Checks

#### Step 1: Add Health Endpoints to Applications
```typescript
// apps/cyclist-profile/src/routes/health.ts
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';

const healthSchema = z.object({
  status: z.enum(['healthy', 'unhealthy']),
  timestamp: z.string(),
  version: z.string(),
  checks: z.object({
    database: z.enum(['up', 'down']),
    memory: z.object({
      used: z.number(),
      total: z.number(),
      percentage: z.number()
    }),
    uptime: z.number()
  })
});

export const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  summary: 'Health check endpoint',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: healthSchema
        }
      },
      description: 'Health check response'
    }
  }
});

export const healthHandler = async (c) => {
  try {
    // Check database connectivity
    const dbStatus = await checkDatabase();
    
    // Check memory usage
    const memUsage = process.memoryUsage();
    const memPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    // Get uptime
    const uptime = process.uptime();
    
    const isHealthy = dbStatus === 'up' && memPercentage < 90;
    
    return c.json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        database: dbStatus,
        memory: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
          percentage: Math.round(memPercentage)
        },
        uptime: Math.round(uptime)
      }
    }, isHealthy ? 200 : 503);
  } catch (error) {
    return c.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    }, 503);
  }
};

async function checkDatabase() {
  try {
    // Add your database connectivity check here
    // Example: await db.raw('SELECT 1');
    return 'up';
  } catch (error) {
    return 'down';
  }
}
```

#### Step 2: Add Readiness Endpoints
```typescript
// apps/cyclist-profile/src/routes/ready.ts
export const readinessRoute = createRoute({
  method: 'get',
  path: '/ready',
  summary: 'Readiness check endpoint',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            ready: z.boolean(),
            timestamp: z.string()
          })
        }
      },
      description: 'Readiness check response'
    }
  }
});

export const readinessHandler = async (c) => {
  try {
    // Check if application is ready to serve traffic
    const dbReady = await checkDatabaseReady();
    const migrationsComplete = await checkMigrations();
    
    const isReady = dbReady && migrationsComplete;
    
    return c.json({
      ready: isReady,
      timestamp: new Date().toISOString(),
      checks: {
        database: dbReady,
        migrations: migrationsComplete
      }
    }, isReady ? 200 : 503);
  } catch (error) {
    return c.json({
      ready: false,
      timestamp: new Date().toISOString(),
      error: error.message
    }, 503);
  }
};
```

### Phase 2: Deployment Verification Workflow

#### Step 1: Add Verification to Release Workflow
```yaml
# Add to .github/workflows/release.yml after GitOps update
  verify-deployment:
    needs: [release-apps, update-gitops]
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app: ${{ fromJson(needs.detect-changes.outputs.matrix) }}
    
    steps:
      - name: Wait for deployment
        run: |
          echo "Waiting for ${{ matrix.app }} deployment to complete..."
          sleep 60  # Give ArgoCD time to sync

      - name: Health check verification
        run: |
          APP_URL="https://api.yourdomain.com/${{ matrix.app }}"
          MAX_RETRIES=30
          RETRY_INTERVAL=10
          
          for i in $(seq 1 $MAX_RETRIES); do
            echo "Health check attempt $i/$MAX_RETRIES for ${{ matrix.app }}"
            
            if curl -f -s "$APP_URL/health" | jq -e '.status == "healthy"' > /dev/null; then
              echo "✅ ${{ matrix.app }} is healthy"
              break
            fi
            
            if [ $i -eq $MAX_RETRIES ]; then
              echo "❌ ${{ matrix.app }} health check failed after $MAX_RETRIES attempts"
              exit 1
            fi
            
            sleep $RETRY_INTERVAL
          done

      - name: Readiness check verification
        run: |
          APP_URL="https://api.yourdomain.com/${{ matrix.app }}"
          
          if curl -f -s "$APP_URL/ready" | jq -e '.ready == true' > /dev/null; then
            echo "✅ ${{ matrix.app }} is ready"
          else
            echo "❌ ${{ matrix.app }} readiness check failed"
            exit 1
          fi

      - name: Smoke tests
        run: |
          APP_URL="https://api.yourdomain.com/${{ matrix.app }}"
          
          # Test critical endpoints
          case "${{ matrix.app }}" in
            "cyclist-profile")
              # Test cyclist profile endpoints
              curl -f "$APP_URL/v1/cyclist-profiles" || exit 1
              ;;
            "docs")
              # Test docs endpoints
              curl -f "$APP_URL/" || exit 1
              curl -f "$APP_URL/openapi" || exit 1
              ;;
            *)
              echo "No specific smoke tests for ${{ matrix.app }}"
              ;;
          esac

      - name: Performance verification
        run: |
          APP_URL="https://api.yourdomain.com/${{ matrix.app }}"
          
          # Simple performance check - response time should be < 2 seconds
          RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' "$APP_URL/health")
          
          if (( $(echo "$RESPONSE_TIME < 2.0" | bc -l) )); then
            echo "✅ Response time OK: ${RESPONSE_TIME}s"
          else
            echo "❌ Response time too slow: ${RESPONSE_TIME}s"
            exit 1
          fi

  rollback-on-failure:
    needs: [verify-deployment]
    if: failure()
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app: ${{ fromJson(needs.detect-changes.outputs.matrix) }}
    
    steps:
      - name: Checkout groundwork repository
        uses: actions/checkout@v4
        with:
          repository: ameciclo/groundwork
          token: ${{ secrets.GROUNDWORK_REPO_TOKEN }}
          path: groundwork

      - name: Rollback to previous version
        run: |
          cd groundwork
          
          # Get previous image tag from git history
          PREVIOUS_TAG=$(git log --oneline -n 2 --grep="deploy: update ${{ matrix.app }}" \
            | tail -n 1 | grep -o 'to [^[:space:]]*' | cut -d' ' -f2)
          
          if [ -z "$PREVIOUS_TAG" ]; then
            echo "❌ Could not find previous version for rollback"
            exit 1
          fi
          
          echo "🔄 Rolling back ${{ matrix.app }} to $PREVIOUS_TAG"
          
          # Update deployment manifest
          sed -i "s|image: ghcr.io/ameciclo/atlas/${{ matrix.app }}:.*|image: ghcr.io/ameciclo/atlas/${{ matrix.app }}:$PREVIOUS_TAG|" \
            helm/charts/atlas/${{ matrix.app }}/deployment.yaml
          
          # Commit rollback
          git add helm/charts/atlas/${{ matrix.app }}/deployment.yaml
          git commit -m "rollback: revert ${{ matrix.app }} to $PREVIOUS_TAG due to deployment failure"
          git push

      - name: Verify rollback
        run: |
          echo "Waiting for rollback to complete..."
          sleep 120  # Give ArgoCD time to sync rollback
          
          APP_URL="https://api.yourdomain.com/${{ matrix.app }}"
          
          if curl -f -s "$APP_URL/health" | jq -e '.status == "healthy"' > /dev/null; then
            echo "✅ Rollback successful - ${{ matrix.app }} is healthy"
          else
            echo "❌ Rollback failed - manual intervention required"
            exit 1
          fi

      - name: Notify team of rollback
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue?.number || 1,
              body: `## 🚨 Automatic Rollback Executed

              **App**: ${{ matrix.app }}
              **Reason**: Deployment verification failed
              **Action**: Automatically rolled back to previous version
              **Status**: ${process.env.ROLLBACK_SUCCESS === 'true' ? '✅ Successful' : '❌ Failed - Manual intervention required'}

              ### Next Steps
              1. Investigate the deployment failure
              2. Fix the issues in the code
              3. Create a new PR with the fixes
              4. Monitor the next deployment carefully

              **Deployment logs**: [View workflow run](https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }})`
            });
```

### Phase 3: Advanced Monitoring Integration

#### Step 1: Metrics Collection
```yaml
      - name: Collect deployment metrics
        run: |
          APP_URL="https://api.yourdomain.com/${{ matrix.app }}"
          
          # Collect metrics for monitoring
          METRICS=$(curl -s "$APP_URL/metrics" || echo "metrics_unavailable")
          ERROR_RATE=$(curl -s "$APP_URL/health" | jq -r '.checks.error_rate // 0')
          RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' "$APP_URL/health")
          
          echo "📊 Deployment metrics for ${{ matrix.app }}:"
          echo "- Error rate: $ERROR_RATE"
          echo "- Response time: ${RESPONSE_TIME}s"
          echo "- Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

## 📋 Implementation Checklist

### Week 1: Health Endpoints
- [ ] Add `/health` endpoints to all applications
- [ ] Add `/ready` endpoints to all applications
- [ ] Implement database connectivity checks
- [ ] Add memory and resource monitoring
- [ ] Test health endpoints locally

### Week 2: Basic Verification
- [ ] Add health check verification to CI/CD
- [ ] Implement readiness check verification
- [ ] Add basic smoke tests for each app
- [ ] Test verification with successful deployments
- [ ] Test verification with failed deployments

### Week 3: Rollback Automation
- [ ] Implement automatic rollback logic
- [ ] Add rollback verification
- [ ] Create team notification system
- [ ] Test rollback scenarios
- [ ] Document rollback procedures

### Week 4: Advanced Features
- [ ] Add performance verification
- [ ] Implement metrics collection
- [ ] Add monitoring integration
- [ ] Create deployment dashboards
- [ ] Set up alerting for failures

## 🎯 Success Criteria

- [ ] **100% deployment verification** coverage
- [ ] **<2 minute verification time** per application
- [ ] **Automatic rollback** within 5 minutes of failure detection
- [ ] **<1% false positive** rate for health checks
- [ ] **Zero failed deployments** reaching production

## 📚 Additional Resources

- [Kubernetes Health Checks](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [ArgoCD Health Checks](https://argo-cd.readthedocs.io/en/stable/operator-manual/health/)
- [Deployment Strategies](https://blog.container-solutions.com/kubernetes-deployment-strategies)
