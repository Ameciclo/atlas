#!/bin/bash
# Script to rebuild docs Docker image with OpenAPI specs
# This is a temporary fix until the CI/CD workflow is updated

set -e

echo "🔧 Rebuilding docs Docker image with OpenAPI specs..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Generate OpenAPI specs
echo -e "${BLUE}Step 1: Generating OpenAPI specs...${NC}"
pnpm turbo run generate-openapi
echo -e "${GREEN}✓ OpenAPI specs generated${NC}"
echo ""

# Step 2: Verify specs exist
echo -e "${BLUE}Step 2: Verifying OpenAPI specs...${NC}"
if [ ! -f "apps/docs/public/openapi/cyclist-profile.json" ]; then
  echo -e "${YELLOW}⚠ Warning: cyclist-profile.json not found${NC}"
  exit 1
fi
if [ ! -f "apps/docs/public/openapi/index.json" ]; then
  echo -e "${YELLOW}⚠ Warning: index.json not found${NC}"
  exit 1
fi
echo -e "${GREEN}✓ OpenAPI specs verified${NC}"
echo ""

# Step 3: Build Docker image
echo -e "${BLUE}Step 3: Building Docker image...${NC}"
docker build -t ghcr.io/ameciclo/atlas/docs:latest -f apps/docs/Dockerfile .
echo -e "${GREEN}✓ Docker image built${NC}"
echo ""

# Step 4: Test the image locally
echo -e "${BLUE}Step 4: Testing image locally...${NC}"
docker run -d --name docs-test -p 8083:80 ghcr.io/ameciclo/atlas/docs:latest
sleep 2

# Check if specs are in the image
echo "Checking OpenAPI specs in container..."
docker exec docs-test ls -la /usr/share/nginx/html/openapi/

# Test the index endpoint
echo ""
echo "Testing OpenAPI index endpoint..."
curl -s http://localhost:8083/openapi/index.json | jq .

# Cleanup test container
docker stop docs-test > /dev/null 2>&1
docker rm docs-test > /dev/null 2>&1
echo -e "${GREEN}✓ Image tested successfully${NC}"
echo ""

# Step 5: Push to registry (optional)
echo -e "${YELLOW}Step 5: Push to GitHub Container Registry (optional)${NC}"
echo "To push the image, run:"
echo ""
echo "  docker push ghcr.io/ameciclo/atlas/docs:latest"
echo ""
echo "Make sure you're logged in first:"
echo "  echo \$GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin"
echo ""

echo -e "${GREEN}✅ Done! Image ready to push.${NC}"
echo ""
echo "Next steps:"
echo "1. Push the image to GitHub Container Registry"
echo "2. In Portainer, pull the latest image"
echo "3. Redeploy the docs service"
echo "4. Verify the documentation loads correctly"

