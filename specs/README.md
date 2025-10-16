# OpenAPI Specifications

This directory contains the **source of truth** for all Atlas API OpenAPI specifications.

## Directory Structure

```
specs/
├── cyclist-profile/
│   ├── v1.json          # Version 1.x specs
│   └── v2.json          # Version 2.x specs (future)
└── other-service/
    └── v1.json
```

## Versioning

- **File naming:** `v{major}.json` (e.g., `v1.json`, `v2.json`)
- **Spec version:** Synced with service's `package.json` version
- **Major version changes:** Create new file (e.g., `v2.json`)
- **Minor/patch changes:** Update existing file

### Example:

| Service Version | Spec File | Spec Version |
|----------------|-----------|--------------|
| 1.0.0          | v1.json   | 1.0.0        |
| 1.5.2          | v1.json   | 1.5.2        |
| 2.0.0          | v2.json   | 2.0.0        |

## Generation Process

OpenAPI specs are **auto-generated** from code during the build process:

1. **Code-first approach:** Routes defined with Hono + Zod
2. **Build time:** `pnpm build` → runs `generate-openapi` task
3. **Dual output:**
   - `specs/{service}/v{major}.json` - Source of truth (versioned)
   - `apps/docs/public/openapi/{service}.json` - For serving docs

## Usage

### For Developers

**Update API version:**
```bash
# Update version in package.json
cd apps/cyclist-profile
npm version minor  # or major/patch

# Regenerate specs
pnpm generate-openapi
```

**View specs:**
```bash
# Local docs
pnpm --filter @atlas/docs dev
# Visit http://localhost:5173

# Or view JSON directly
cat specs/cyclist-profile/v1.json
```

### For CI/CD

Specs are validated in CI to catch breaking changes:

```yaml
- name: Validate OpenAPI specs
  run: pnpm openapi:validate
```

## Best Practices

1. ✅ **Never edit specs manually** - They're auto-generated
2. ✅ **Commit specs to git** - They're the API contract
3. ✅ **Version appropriately:**
   - Patch (1.0.x): Bug fixes, clarifications
   - Minor (1.x.0): New endpoints, optional fields
   - Major (x.0.0): Breaking changes
4. ✅ **Review spec changes in PRs** - Like any code change
5. ✅ **Keep old versions** - Don't delete v1.json when creating v2.json

## Validation

Specs are validated for:
- ✅ Valid OpenAPI 3.1.0 format
- ✅ No breaking changes (compared to previous version)
- ✅ Consistent naming conventions
- ✅ Required fields present

## Related Documentation

- **[OpenAPI Workflow](../docs/OPENAPI_WORKFLOW.md)** - How specs are generated
- **[Create New Service](../docs/CREATE_NEW_SERVICE.md)** - Adding new services
- **[Deployment](../deployment/portainer/README.md)** - Deploying services

