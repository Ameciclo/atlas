# CI/CD Workflows

This directory contains GitHub Actions workflows for continuous integration and deployment.

## Workflow Structure

The CI/CD process is split into multiple workflows for better maintainability and performance:

1. **Lint (`lint.yml`)**: Runs code formatting, linting, and type checking
2. **Build and Test (`build-test.yml`)**: Builds and tests affected packages
3. **Deploy (`deploy.yml`)**: Builds and pushes Docker images for affected apps

## Key Features

### Turbo-Ignore for Early Skipping

All workflows use `turbo-ignore` to skip unnecessary CI runs:

```yaml
- name: Check if build is needed
  if: github.event_name == 'pull_request'
  run: |
    npx turbo-ignore
```

This tool:
- Analyzes changes in the PR
- Determines if any Turborepo tasks would be affected
- Exits the workflow early if no tasks would be affected
- Saves CI resources for PRs that only change non-code files (like documentation)

### Affected-Only Processing

All workflows use Turborepo's `--affected` flag to only process packages that have changed:

```yaml
pnpm turbo run build --affected -- --from=origin/$BASE_REF
```

This approach:
- Speeds up CI/CD by only building what changed
- Reduces resource usage
- Prevents unnecessary deployments

### Dynamic App Detection

The workflows automatically detect which apps have been affected by changes:

```yaml
# Get all affected packages using --affected
AFFECTED_ALL=$(pnpm turbo run build --dry-run --affected -- --from=origin/$BASE_REF | grep -o '@atlas/[a-z-]*' | sort | uniq)

# Extract apps (packages in the apps directory)
AFFECTED_APPS=$(echo "$AFFECTED_ALL" | grep -v "@atlas/typescript-config" | sed 's/@atlas\///' | jq -R -s -c 'split("\n") | map(select(length > 0))')
```

### Conditional Deployment

Docker images are only built and pushed for apps that have been affected:

```yaml
if: contains(fromJson(needs.determine-affected.outputs.affected-apps), 'docs')
```

## Usage

These workflows run automatically on:
- Pull requests to the `main` branch
- Pushes to the `main` branch

No manual intervention is required for normal development workflows.

## OpenAPI Generation in CI

### Overview

OpenAPI specs are generated in CI/CD after the build completes. This approach:
- ✅ Keeps builds fast (no database required)
- ✅ Ensures specs are always up-to-date
- ✅ Uses real database schema for generation
- ✅ Commits specs back to the repository

### How It Works

1. **Build Job**: Compiles TypeScript (no database needed)
2. **Generate OpenAPI Job**:
   - Starts PostgreSQL service
   - Runs database migrations
   - Generates OpenAPI specs
   - Commits specs to repository

### Local Development

To generate OpenAPI specs locally:

```bash
# Ensure database is running and migrated
docker-compose up -d postgres
pnpm --filter @atlas/database db:migrate

# Generate OpenAPI for an app
pnpm --filter @atlas/cyclist-profile generate-openapi
```

### Adding OpenAPI to a New App

See [Database Package Usage](../../packages/database/USAGE.md) for detailed instructions.

## Troubleshooting

If you encounter issues with the CI/CD process:

1. Check the workflow logs for error messages
2. Verify that Turborepo is correctly detecting affected packages
3. Ensure that all required environment variables and secrets are set
4. Try running the same commands locally to reproduce the issue

### OpenAPI Generation Issues

**Problem**: OpenAPI generation fails in CI

**Solutions**:
- Check that database migrations ran successfully
- Verify `DATABASE_URL` is set correctly in the workflow
- Ensure the app's schema exists in the database
- Check that the `generate-openapi` script exists in the app
