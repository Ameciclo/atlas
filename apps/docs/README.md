# Atlas API Documentation

This app provides a user-friendly interface for viewing the OpenAPI documentation for all Atlas APIs.

## Features

- Interactive API documentation using Scalar API Reference
- Automatic loading of OpenAPI specs from other apps in the monorepo
- Modern UI with syntax highlighting and request/response examples
- Containerized deployment with Docker

## Getting Started

### Running the Documentation

The OpenAPI specs are automatically generated as part of the development process. Simply run:

```bash
# From the root of the monorepo
pnpm dev
```

This will:
1. Run the pre-dev tasks, including generating the latest OpenAPI specs
2. Start all the services, including the API services and the documentation app

The documentation app will be available at http://localhost:3001, and the API services will be available at their respective ports.

### Manually Generating OpenAPI Specs

If you need to manually generate the OpenAPI specs without starting the services:

```bash
# Generate specs for a specific service
pnpm --filter @atlas/cyclist-profile generate-openapi

# Or run the pre-dev task for all services
pnpm turbo run pre-dev
```

The documentation app will be available at http://localhost:3001

## Adding New API Documentation

The docs app automatically discovers and displays OpenAPI specs from all API services in the monorepo. When you create a new API service:

1. Make sure it uses Hono with @hono/zod-openapi for route definitions
2. Copy the template from `templates/generate-openapi.ts` to your API service's src directory
3. Customize the template with your API's name and metadata
4. Add the `generate-openapi` and `pre-dev` scripts to your API service's package.json
5. Run `pnpm dev` to see your API in the documentation

For detailed instructions, see the [README-openapi.md](../templates/README-openapi.md) file in the templates directory.

## Docker Deployment

The documentation app can be deployed as a Docker container. The container image is automatically built and pushed to GitHub Container Registry (ghcr.io) when changes are merged to the main branch.

### Running with Docker

To run the documentation app using Docker:

```bash
# Pull the latest image
docker pull ghcr.io/ameciclo/atlas/docs:latest

# Run the container
docker run -p 8080:80 ghcr.io/ameciclo/atlas/docs:latest
```

The documentation will be available at http://localhost:8080

### Building Locally

You can also build and run the Docker image locally:

```bash
# From the docs app directory
docker compose up -d

# Or from the root of the monorepo
docker build -t atlas-docs -f apps/docs/Dockerfile .
docker run -p 8080:80 atlas-docs
```

## Technologies Used

- [Vite](https://vitejs.dev/) - Fast development server and build tool
- [React](https://react.dev/) - UI library
- [Scalar API Reference](https://github.com/scalar/scalar) - OpenAPI documentation viewer
- [Docker](https://www.docker.com/) - Containerization
- [GitHub Container Registry](https://ghcr.io) - Container registry
