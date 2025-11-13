#!/bin/bash

# Turbo-powered deployment script
# Usage: ./scripts/deploy.sh [app-name] [environment]

set -e

APP_NAME=${1:-""}
ENVIRONMENT=${2:-"staging"}

if [ -z "$APP_NAME" ]; then
    echo "❌ Error: App name is required"
    echo "Usage: $0 <app-name> [environment]"
    echo "Available apps:"
    find apps -name "package.json" -type f | cut -d'/' -f2 | sort
    exit 1
fi

if [ ! -d "apps/$APP_NAME" ]; then
    echo "❌ Error: App 'apps/$APP_NAME' does not exist"
    exit 1
fi

if [ ! -f "apps/$APP_NAME/Dockerfile" ]; then
    echo "❌ Error: App '$APP_NAME' is not deployable (no Dockerfile)"
    exit 1
fi

echo "🚀 Deploying $APP_NAME to $ENVIRONMENT using Turbo..."

# Use Turbo to build only what's needed
echo "📦 Building dependencies..."
turbo run build --filter="$APP_NAME"

# Run tests for the specific app
echo "🧪 Running tests..."
turbo run test --filter="$APP_NAME" || echo "⚠️  Tests failed or not available"

# Run linting
echo "🔍 Linting..."
turbo run lint --filter="$APP_NAME"

# Get app version
APP_VERSION=$(jq -r '.version' "apps/$APP_NAME/package.json")
echo "📋 App version: $APP_VERSION"

# Build Docker image
echo "🐳 Building Docker image..."
IMAGE_NAME="ghcr.io/ameciclo/atlas/$APP_NAME"
IMAGE_TAG="${ENVIRONMENT == 'production' && $APP_VERSION || 'latest'}"

docker build \
    -f "apps/$APP_NAME/Dockerfile" \
    -t "$IMAGE_NAME:$IMAGE_TAG" \
    -t "$IMAGE_NAME:sha-$(git rev-parse --short HEAD)" \
    .

echo "✅ Successfully built $IMAGE_NAME:$IMAGE_TAG"

# Optional: Push to registry (if in CI)
if [ "$CI" = "true" ]; then
    echo "📤 Pushing to registry..."
    docker push "$IMAGE_NAME:$IMAGE_TAG"
    docker push "$IMAGE_NAME:sha-$(git rev-parse --short HEAD)"
    echo "✅ Successfully pushed to registry"
fi

echo "🎉 Deployment preparation complete for $APP_NAME ($IMAGE_TAG)"
