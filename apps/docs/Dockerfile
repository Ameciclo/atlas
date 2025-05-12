# Prune stage - Use turbo to create a subset of the monorepo with only the packages needed
FROM node:22.15.0-slim AS pruner

# Set working directory
WORKDIR /app

# Install pnpm and turbo
RUN corepack enable && corepack prepare pnpm@10.10.0 --activate && \
    npm install -g turbo

# Copy repo configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy the source code needed for turbo prune
COPY apps/docs/package.json ./apps/docs/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json

# Use turbo to prune the monorepo to only the docs app and its dependencies
RUN turbo prune --scope=@atlas/docs --docker

# Build stage - Use the pruned repo to build the app
FROM node:22.15.0-slim AS builder

# Set working directory
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.10.0 --activate

# Copy pruned lockfile and package.json files
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Copy source files from pruned repo
COPY --from=pruner /app/out/full/ .

# Copy the rest of the source code
COPY apps/docs ./apps/docs
COPY packages/typescript-config ./packages/typescript-config
COPY turbo.json ./turbo.json

# Copy OpenAPI specs (these should be generated in CI before this step)
COPY apps/docs/public/openapi ./apps/docs/public/openapi

# Build the docs app
RUN pnpm --filter @atlas/docs build

# Production stage
FROM nginx:alpine AS production

# Copy built assets from builder stage
COPY --from=builder /app/apps/docs/dist /usr/share/nginx/html

# Copy nginx configuration
COPY apps/docs/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
