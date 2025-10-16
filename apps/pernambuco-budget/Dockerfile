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
COPY apps/pernambuco-budget/package.json ./apps/pernambuco-budget/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json

# Use turbo to prune the monorepo to only the pernambuco-budget app and its dependencies
RUN turbo prune --scope=@atlas/pernambuco-budget --docker

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
RUN pnpm install --frozen-lockfile

# Copy source files from pruned repo
COPY --from=pruner /app/out/full/ .

# Copy the rest of the source code
COPY apps/pernambuco-budget ./apps/pernambuco-budget
COPY packages/typescript-config ./packages/typescript-config
COPY turbo.json ./turbo.json

# Build the pernambuco-budget app
RUN pnpm --filter @atlas/pernambuco-budget build

# Production stage
FROM node:22.15.0-slim AS production

# Set working directory
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.10.0 --activate

# Copy pruned lockfile and package.json files
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built files from builder stage
COPY --from=builder /app/apps/pernambuco-budget/dist ./apps/pernambuco-budget/dist
# Copy migrations folder
COPY --from=builder /app/apps/pernambuco-budget/src/db/migrations ./apps/pernambuco-budget/src/db/migrations

# Set environment variables
ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV PORT=3015

# Expose port (can be overridden at runtime)
EXPOSE ${PORT}

# Default command to start the application
CMD ["node", "apps/pernambuco-budget/dist/index.js"]
