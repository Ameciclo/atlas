# Build stage
FROM node:20-alpine@sha256:c628bdc7ebc7f95b1b23249a445eb415ce68ae9def8b68364b35ee15e3065b0f AS builder

# Set working directory
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy package.json files and workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/docs/package.json ./apps/docs/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY apps/cyclist-profile/package.json ./apps/cyclist-profile/

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Copy source files
COPY . .

# Install all dependencies to ensure they're available for OpenAPI generation
RUN pnpm install --no-frozen-lockfile

# Generate OpenAPI specs and build the docs app
RUN pnpm turbo run generate-openapi
RUN pnpm --filter @atlas/docs build

# Production stage
FROM nginx:alpine@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10 AS production

# Copy built assets from builder stage
COPY --from=builder /app/apps/docs/dist /usr/share/nginx/html

# Copy nginx configuration
COPY apps/docs/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
