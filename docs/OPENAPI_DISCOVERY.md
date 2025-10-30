# OpenAPI Auto-Discovery

This document explains how the OpenAPI auto-discovery system works in the Atlas monorepo.

## Overview

The OpenAPI discovery system automatically finds and generates OpenAPI specifications for all API apps in the monorepo. **No manual registration required!**

## How It Works

### Discovery Criteria

An app is automatically discovered if it meets **both** of these criteria:

1. ✅ Has a `generate-openapi` script in `package.json`
2. ✅ Has a `src/generate-openapi.ts` file

### Discovery Process

When you run `pnpm generate-openapi`, the system:

1. **Scans** all directories in `apps/`
2. **Checks** each app for the discovery criteria
3. **Runs** `generate-openapi` script for each discovered app
4. **Copies** generated specs to the docs app
5. **Generates** an index of all available specs

## Usage

### Generate All OpenAPI Specs

```bash
# From the root of the monorepo
pnpm generate-openapi
```

This will:
- Auto-discover all API apps
- Generate OpenAPI specs for each
- Copy specs to `apps/docs/public/openapi/`
- Generate an index file for the docs app

### Generate for a Single App

```bash
# Generate for a specific app
pnpm --filter @atlas/traffic-deaths generate-openapi
```

### During Development

Each app can still generate its own spec independently:

```bash
# In the app directory
cd apps/traffic-deaths
pnpm generate-openapi
```

Or use the `pre-dev` script (runs automatically before `dev`):

```bash
pnpm dev  # Automatically generates OpenAPI spec first
```

## Adding OpenAPI to a New App

When creating a new API app, follow these steps to make it discoverable:

### 1. Create the Generate Script

Create `src/generate-openapi.ts` in your app:

```typescript
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import app from "./app.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_NAME = "my-api";  // Change this to your app name

function getVersion(): string {
  try {
    const packageJsonPath = path.resolve(__dirname, "../package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    return packageJson.version || "1.0.0";
  } catch (_error) {
    console.warn("Could not read version from package.json, using 1.0.0");
    return "1.0.0";
  }
}

async function generateOpenAPISpec() {
  try {
    const version = getVersion();
    const openAPIDoc = app.getOpenAPIDocument({
      openapi: "3.1.0",
      info: {
        title: "My API",
        version,
        description: "Description of my API",
        contact: {
          name: "Atlas Team",
          url: "https://github.com/Ameciclo/atlas",
        },
      },
      servers: [
        {
          url: `http://localhost:${process.env.PORT || "3000"}`,
          description: "Local development server",
        },
      ],
      tags: [
        {
          name: "Example",
          description: "Example endpoints",
        },
      ],
    });

    const specJson = JSON.stringify(openAPIDoc, null, 2);

    // 1. Write to centralized specs directory
    const specsDir = path.resolve(__dirname, "../../../specs", API_NAME);
    fs.mkdirSync(specsDir, { recursive: true });
    const specsPath = path.join(specsDir, `v${version.split(".")[0]}.json`);
    fs.writeFileSync(specsPath, specJson);
    console.log(`✓ OpenAPI spec written to ${specsPath}`);

    // 2. Write to docs public directory
    const docsDir = path.resolve(__dirname, "../../docs/public/openapi");
    fs.mkdirSync(docsDir, { recursive: true });
    const docsPath = path.join(docsDir, `${API_NAME}.json`);
    fs.writeFileSync(docsPath, specJson);
    console.log(`✓ OpenAPI spec copied to ${docsPath}`);

    console.log("\nGenerated OpenAPI spec for routes:");
    const paths = Object.keys(openAPIDoc.paths || {});
    for (const path of paths) {
      console.log(`  - ${path}`);
    }
  } catch (error) {
    console.error("Failed to generate OpenAPI spec:", error);
    process.exit(1);
  }
}

generateOpenAPISpec();
```

### 2. Add Script to package.json

Add the `generate-openapi` script to your app's `package.json`:

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "generate-openapi": "tsx src/generate-openapi.ts",
    "pre-dev": "pnpm generate-openapi"
  }
}
```

### 3. Test Discovery

Run the discovery script to verify your app is detected:

```bash
pnpm generate-openapi
```

You should see your app in the list of discovered apps!

## File Structure

```
atlas/
├── apps/
│   ├── my-api/
│   │   ├── src/
│   │   │   ├── app.ts                    # Hono app with OpenAPI routes
│   │   │   └── generate-openapi.ts       # ← Discovery criterion #2
│   │   └── package.json                  # ← Contains "generate-openapi" script (criterion #1)
│   └── docs/
│       ├── public/
│       │   └── openapi/
│       │       ├── my-api.json           # ← Generated spec (copied here)
│       │       └── index.json            # ← Auto-generated index
│       └── scripts/
│           └── generate-openapi-index.js # Generates index.json
├── specs/
│   └── my-api/
│       └── v1.json                       # ← Generated spec (source of truth)
└── scripts/
    └── generate-all-openapi.ts           # ← Discovery script
```

## Benefits

### ✅ Zero Configuration

- Create `src/generate-openapi.ts` → automatically discovered
- No manual registration in any central file
- No need to update CI/CD configs

### ✅ Consistent Behavior

- All apps follow the same pattern
- Specs are always in sync
- Single command generates all specs

### ✅ Developer Friendly

- Clear discovery criteria
- Easy to add new apps
- Self-documenting system

## Troubleshooting

### My app isn't being discovered

Check that your app has:

1. A `generate-openapi` script in `package.json`
2. A `src/generate-openapi.ts` file

Run with verbose output to see what's being discovered:

```bash
pnpm generate-openapi
```

### OpenAPI spec not updating

Make sure you're running the generate script after making changes:

```bash
pnpm generate-openapi
```

Or rebuild the app (which triggers generation):

```bash
pnpm build
```

### Spec not showing in docs

The docs app needs to rebuild to pick up new specs:

```bash
pnpm --filter @atlas/docs build
```

## Related Documentation

- [Creating a New App](../CONTRIBUTING.md#adding-a-new-app)
- [Hono OpenAPI Documentation](https://hono.dev/docs/guides/zod-openapi)
- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html)

