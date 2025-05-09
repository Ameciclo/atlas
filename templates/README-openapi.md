# Adding OpenAPI Generation to a New API Service

This guide explains how to add OpenAPI spec generation to a new API service in the Atlas monorepo.

## Prerequisites

- Your API service should use Hono with @hono/zod-openapi for route definitions
- Your API service should be set up as a package in the monorepo

## Steps to Add OpenAPI Generation

1. **Copy the Template File**

   Copy the `generate-openapi.ts` template to your API service's src directory:

   ```bash
   cp templates/generate-openapi.ts apps/your-api-service/src/
   ```

2. **Customize the Template**

   Edit the file to update:
   - The `API_NAME` constant (use kebab-case)
   - The API title, description, and other metadata
   - The server URL (if your service runs on a different port)
   - The API tags to match your route definitions

3. **Add Scripts to package.json**

   Add the following scripts to your API service's package.json:

   ```json
   "scripts": {
     "generate-openapi": "tsx src/generate-openapi.ts",
     "pre-dev": "pnpm generate-openapi",
     "dev": "tsx watch src/index.ts",
     "build": "tsc && pnpm generate-openapi"
   }
   ```

4. **Test the Generation**

   Run the generation script to make sure it works:

   ```bash
   pnpm --filter @atlas/your-api-service generate-openapi
   ```

   This should create a JSON file in the `apps/docs/public/openapi` directory.

5. **Run the Development Server**

   Start the development server to see your API documentation:

   ```bash
   pnpm dev
   ```

   The docs app will automatically discover and display your API's OpenAPI spec.

## How It Works

- Each API service generates its own OpenAPI spec file during the `pre-dev` phase
- The docs app scans the `public/openapi` directory and creates an index of available specs
- The docs app dynamically loads and displays all discovered specs

## Troubleshooting

If your API doesn't appear in the documentation:

1. Check that the OpenAPI spec file was generated in `apps/docs/public/openapi`
2. Make sure your routes are properly defined with OpenAPI metadata
3. Try running `pnpm turbo run pre-dev` to regenerate all specs
4. Check the browser console for any errors loading the specs
