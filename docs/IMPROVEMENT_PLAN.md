# Atlas Improvement Plan

This document outlines a comprehensive plan to address identified issues and implement improvements across the Atlas monorepo.

## 🔴 Critical Issues

### 1. Missing Husky Git Hooks

**Problem:** Git hooks are configured but Husky is not installed, so they don't run.

**Impact:** Code quality checks can be bypassed, leading to inconsistent code in the repository.

**Solution:**
- [ ] Install Husky: `pnpm add -D husky -w`
- [ ] Initialize Husky: `pnpm exec husky init`
- [ ] Create pre-commit hook to run Biome checks
- [ ] Create commit-msg hook for conventional commits validation
- [ ] Update root `package.json` with prepare script
- [ ] Document hook setup in README.md

**Files to modify:**
- `package.json` (root)
- `.husky/pre-commit` (new)
- `.husky/commit-msg` (new)
- `README.md`

**Estimated effort:** 1-2 hours

---

### 2. Missing Environment Variable Documentation

**Problem:** No `.env.example` files in apps, making it unclear what environment variables are needed.

**Impact:** New developers won't know what environment variables to configure.

**Solution:**
- [ ] Create `.env.example` for `apps/cyclist-profile`
- [ ] Document all required environment variables with descriptions
- [ ] Add optional variables with default values
- [ ] Update scaffolding tool to generate `.env.example` for new services
- [ ] Add environment variable documentation to each app's README

**Files to create:**
- `apps/cyclist-profile/.env.example`

**Files to modify:**
- `packages/create-atlas-app/src/generators/index.ts`
- `apps/cyclist-profile/README.md`
- `docs/CREATE_NEW_SERVICE.md`

**Estimated effort:** 2-3 hours

---

### 3. Deployment Workflow is a Placeholder

**Problem:** The `deploy.yml` workflow doesn't actually deploy anything.

**Impact:** Manual deployment required despite having CI/CD infrastructure.

**Solution:**
- [ ] Determine deployment target (Cloud Run, ECS, Kubernetes, etc.)
- [ ] Implement actual deployment logic in `deploy.yml`
- [ ] Add deployment secrets to GitHub repository
- [ ] Create deployment documentation
- [ ] Add rollback mechanism
- [ ] Test deployment in staging environment

**Files to modify:**
- `.github/workflows/deploy.yml`
- `docs/DEPLOYMENT.md` (new)

**Estimated effort:** 4-8 hours (depends on deployment platform)

---

## 🟡 Moderate Issues

### 4. Inconsistent Caching Strategy

**Problem:** Tests and OpenAPI generation have caching disabled in `turbo.json`.

**Impact:** Slower CI/CD pipelines and local development.

**Solution:**
- [ ] Enable caching for tests with proper inputs (source files, test files)
- [ ] Enable caching for `generate-openapi` based on source changes
- [ ] Add proper `inputs` and `outputs` configuration
- [ ] Test cache invalidation works correctly
- [ ] Document caching strategy

**Files to modify:**
- `turbo.json`
- `docs/TURBOREPO.md` (new)

**Estimated effort:** 2-3 hours

---

### 5. Docker Build Inefficiencies

**Problem:** Dockerfile uses `--no-frozen-lockfile` and manual file copying.

**Impact:** Inconsistent builds and potential security issues.

**Solution:**
- [ ] Change to `--frozen-lockfile` for production builds
- [ ] Use glob patterns for copying package.json files
- [ ] Add multi-stage build optimization
- [ ] Implement layer caching best practices
- [ ] Update scaffolding tool to generate optimized Dockerfile

**Files to modify:**
- `apps/cyclist-profile/Dockerfile`
- `packages/create-atlas-app/src/generators/dockerfile.ts`
- `docs/DOCKER.md` (new)

**Estimated effort:** 2-4 hours

---

### 6. Missing Security Scanning

**Problem:** No dependency vulnerability scanning or container image scanning.

**Impact:** Security vulnerabilities may go undetected.

**Solution:**
- [ ] Enable GitHub Dependabot for dependency updates
- [ ] Add Dependabot configuration file
- [ ] Integrate Trivy for container image scanning
- [ ] Add security scanning to CI workflow
- [ ] Set up security policy (SECURITY.md)
- [ ] Configure automated security alerts

**Files to create:**
- `.github/dependabot.yml`
- `SECURITY.md`

**Files to modify:**
- `.github/workflows/ci.yml`
- `README.md`

**Estimated effort:** 3-4 hours

---

### 7. No Database Backup/Migration Rollback Strategy

**Problem:** Migrations run automatically but no rollback mechanism exists.

**Impact:** Database issues could cause downtime without recovery options.

**Solution:**
- [ ] Document migration rollback procedures
- [ ] Create migration rollback scripts
- [ ] Implement database backup strategy
- [ ] Add pre-migration backup automation
- [ ] Document disaster recovery procedures
- [ ] Create database utilities package

**Files to create:**
- `docs/DATABASE_MIGRATIONS.md`
- `docs/DISASTER_RECOVERY.md`
- `packages/db-utils/` (new package)

**Estimated effort:** 4-6 hours

---

### 8. Test Coverage Not Tracked

**Problem:** Tests run but no coverage reports or thresholds.

**Impact:** Unknown code coverage, potential gaps in testing.

**Solution:**
- [ ] Configure Vitest coverage collection
- [ ] Set coverage thresholds (e.g., 80% minimum)
- [ ] Add coverage reporting to CI
- [ ] Generate coverage badges
- [ ] Upload coverage to Codecov or similar service
- [ ] Update scaffolding tool to include coverage config

**Files to modify:**
- `apps/cyclist-profile/vitest.config.ts`
- `.github/workflows/ci.yml`
- `packages/create-atlas-app/src/generators/vitest-config.ts` (new)
- `README.md`

**Estimated effort:** 2-3 hours

---

## 🟢 Minor Improvements

### 9. Biome VCS Integration Disabled

**Problem:** Biome VCS integration is disabled in configuration.

**Impact:** Missing out on Git-aware linting features.

**Solution:**
- [ ] Enable VCS integration in `biome.json`
- [ ] Configure VCS-specific rules
- [ ] Test integration with Git workflows
- [ ] Document VCS features

**Files to modify:**
- `biome.json`

**Estimated effort:** 30 minutes

---

### 10. Missing Monorepo Best Practices

**Problem:** No shared packages for utilities, types, or database code.

**Impact:** Code duplication across services.

**Solution:**
- [ ] Create `@atlas/shared-utils` package for common utilities
- [ ] Create `@atlas/shared-types` package for shared TypeScript types
- [ ] Create `@atlas/db-utils` package for database utilities
- [ ] Update existing apps to use shared packages
- [ ] Document shared package usage

**Files to create:**
- `packages/shared-utils/`
- `packages/shared-types/`
- `packages/db-utils/`

**Files to modify:**
- `pnpm-workspace.yaml`
- `docs/MONOREPO_STRUCTURE.md` (new)

**Estimated effort:** 4-6 hours

---

### 11. Documentation Gaps

**Problem:** Missing architecture diagrams, contribution guidelines, and changelog.

**Impact:** Harder for new contributors to understand and contribute to the project.

**Solution:**
- [ ] Create architecture diagrams using Mermaid
- [ ] Write CONTRIBUTING.md with guidelines
- [ ] Create CHANGELOG.md
- [ ] Document API versioning strategy
- [ ] Add code of conduct
- [ ] Create issue and PR templates

**Files to create:**
- `CONTRIBUTING.md`
- `CHANGELOG.md`
- `CODE_OF_CONDUCT.md`
- `docs/ARCHITECTURE.md`
- `docs/API_VERSIONING.md`
- `.github/ISSUE_TEMPLATE/` (directory)
- `.github/PULL_REQUEST_TEMPLATE.md`

**Estimated effort:** 4-6 hours

---

### 12. Missing Development Tools

**Problem:** No commit message linting, changelog generation, or release automation.

**Impact:** Inconsistent commit messages and manual release process.

**Solution:**
- [ ] Install and configure commitlint
- [ ] Add commitlint to Husky hooks
- [ ] Set up conventional-changelog for automated changelog
- [ ] Configure semantic-release or similar tool
- [ ] Add release workflow to GitHub Actions
- [ ] Document release process

**Files to create:**
- `.commitlintrc.json`
- `.releaserc.json`
- `.github/workflows/release.yml`

**Files to modify:**
- `package.json` (root)
- `.husky/commit-msg`
- `docs/RELEASE_PROCESS.md` (new)

**Estimated effort:** 3-4 hours

---

### 13. Docker Compose for Development

**Problem:** `docker-dev` package exists but isn't well documented.

**Impact:** Unclear how to use Docker for local development.

**Solution:**
- [ ] Document docker-dev package usage
- [ ] Create comprehensive Docker development guide
- [ ] Add examples for common scenarios
- [ ] Clarify when to use docker-dev vs app-specific compose files
- [ ] Add troubleshooting section

**Files to modify:**
- `packages/docker-dev/README.md`
- `docs/DOCKER_DEVELOPMENT.md` (new)
- `README.md`

**Estimated effort:** 2-3 hours

---

### 14. CI/CD Optimization Opportunities

**Problem:** CI/CD could be faster and more efficient.

**Impact:** Slower feedback loops for developers.

**Solution:**
- [ ] Implement `pnpm fetch` for faster dependency installation
- [ ] Add parallel job execution where possible
- [ ] Implement build time tracking
- [ ] Add build performance reporting
- [ ] Cache Docker layers more effectively
- [ ] Optimize Turborepo cache configuration

**Files to modify:**
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `turbo.json`

**Estimated effort:** 3-4 hours

---

### 15. Monitoring & Observability

**Problem:** No metrics endpoint, limited logging, no APM/tracing.

**Impact:** Difficult to monitor application health and debug issues in production.

**Solution:**
- [ ] Add Prometheus metrics endpoint to services
- [ ] Configure structured logging with Pino
- [ ] Add request tracing with OpenTelemetry
- [ ] Create monitoring dashboard templates
- [ ] Document observability setup
- [ ] Add alerting configuration examples

**Files to modify:**
- `apps/cyclist-profile/src/index.ts`
- `apps/cyclist-profile/src/lib/logger.ts`
- `docs/OBSERVABILITY.md` (new)
- `packages/create-atlas-app/src/generators/src-files.ts`

**Estimated effort:** 6-8 hours

---

## Implementation Priority

### Phase 1: Critical Fixes (Week 1)
1. Missing Husky Git Hooks
2. Missing Environment Variable Documentation
3. Deployment Workflow

### Phase 2: Quality & Security (Week 2)
4. Inconsistent Caching Strategy
5. Docker Build Inefficiencies
6. Missing Security Scanning
7. Test Coverage Tracking

### Phase 3: Developer Experience (Week 3)
8. Database Backup/Migration Strategy
9. Biome VCS Integration
10. Missing Development Tools
11. Documentation Gaps

### Phase 4: Optimization & Observability (Week 4)
12. Monorepo Best Practices
13. Docker Compose Documentation
14. CI/CD Optimization
15. Monitoring & Observability

## Success Metrics

- ✅ All git hooks running automatically
- ✅ 100% of services have `.env.example` files
- ✅ Automated deployment working for all services
- ✅ Test coverage > 80% across all packages
- ✅ Zero high/critical security vulnerabilities
- ✅ CI/CD pipeline < 5 minutes for typical changes
- ✅ All documentation complete and up-to-date
- ✅ Metrics and logging available for all services

## Notes

- Each task should be implemented in a separate PR for easier review
- All changes should include tests where applicable
- Documentation should be updated alongside code changes
- Breaking changes should be clearly communicated

