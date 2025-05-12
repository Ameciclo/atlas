# Testing GitHub Actions Workflows Locally

Since Act may have issues on macOS, here are alternative approaches to test your GitHub Actions workflows locally.

## Option 1: GitHub CLI

The GitHub CLI (`gh`) provides tools to work with GitHub Actions workflows.

### Installation

```bash
# Install GitHub CLI
brew install gh

# Login to GitHub
gh auth login
```

### Usage

```bash
# List workflows
gh workflow list

# View a specific workflow
gh workflow view ci.yml

# Run a workflow manually
gh workflow run ci.yml

# View workflow runs
gh run list --workflow=ci.yml
```

## Option 2: Local Workflow Validation

You can validate your workflow syntax locally without running the actual workflows.

### Installation

```bash
# Install actionlint
brew install actionlint
```

### Usage

```bash
# Validate all workflows
actionlint

# Validate a specific workflow
actionlint .github/workflows/ci.yml
```

## Option 3: Docker-based Testing

For testing specific actions or steps, you can use Docker directly.

### Example: Testing Node.js Setup

```bash
# Run a Node.js container with the same version as your workflow
docker run --rm -it -v $(pwd):/app -w /app node:22.15.0-slim bash

# Inside the container, run your setup steps
corepack enable
corepack prepare pnpm@10.10.0 --activate
pnpm install
pnpm build
```

## Option 4: GitHub Actions Runner in Docker

You can run a GitHub Actions runner in Docker for more complete testing.

```bash
# Pull the GitHub Actions runner image
docker pull myoung34/github-runner:latest

# Run the runner (replace TOKEN and REPO with your values)
docker run -d --name github-runner \
  -e REPO_URL="https://github.com/username/repo" \
  -e RUNNER_NAME="local-runner" \
  -e RUNNER_TOKEN="TOKEN" \
  -e RUNNER_WORKDIR="/tmp/github-runner-your-repo" \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /tmp/github-runner-your-repo:/tmp/github-runner-your-repo \
  myoung34/github-runner:latest
```

## Option 5: GitHub Sandbox Environment

For complex workflows, consider using a GitHub sandbox repository:

1. Create a private test repository
2. Copy your workflows there
3. Test changes in this sandbox before applying to your main repository
4. Use branch protection rules to prevent accidental merges

This approach allows you to test workflows in the actual GitHub environment without affecting your production repository.
