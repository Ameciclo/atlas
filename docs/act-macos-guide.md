# Using Act on macOS with Apple Silicon (M1/M2/M3)

This guide provides instructions for using [Act](https://github.com/nektos/act) to test GitHub Actions workflows locally on macOS with Apple Silicon chips.

## Prerequisites

- Docker Desktop for Mac
- Node.js and npm
- Act installed via Homebrew: `brew install act`

## Setup

1. **Create an `.actrc` file** in your repository root (based on the provided `.actrc.example`):

```
-P ubuntu-latest=node:22.15.0-slim
--container-architecture linux/amd64
--bind
-s GITHUB_TOKEN=$GITHUB_TOKEN
--secret-file=.env
```

2. **Create an `.env` file** for secrets:

```
# GitHub token for authentication (if needed)
GITHUB_TOKEN=

# Add any other environment variables your workflows need here
```

3. **Create a simple test workflow** to verify Act is working:

```yaml
# .github/workflows/act-test.yml
name: Act Test

on:
  workflow_dispatch:

jobs:
  hello-world:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Hello World
        run: echo "Hello, World!"
```

## Running Workflows

### Basic Commands

```bash
# List available workflows
act -l

# Run a specific workflow
act -W .github/workflows/act-test.yml

# Run a specific job
act -W .github/workflows/ci.yml -j build

# Dry run (show what would happen without executing)
act -W .github/workflows/ci.yml --dryrun
```

### Tips for macOS with Apple Silicon

1. **Architecture Issues**: Always use the `--container-architecture linux/amd64` flag or set it in your `.actrc` file.

2. **Docker Images**: Use Node.js-based images like `node:22.15.0-slim` instead of Ubuntu images for better compatibility.

3. **Memory Limits**: If you encounter memory issues, increase Docker's memory allocation in Docker Desktop preferences.

4. **Simplified Workflows**: For testing complex workflows, create simplified versions that focus on specific steps.

5. **GitHub Authentication**: For workflows that require GitHub API access, set a valid `GITHUB_TOKEN` in your `.env` file.

## Working with Private Repositories

When testing workflows for private repositories, you'll need to handle authentication:

1. **Set a GitHub Token**: Create a Personal Access Token (PAT) with appropriate permissions and set it in your `.env` file:

```
GITHUB_TOKEN=your_personal_access_token
```

2. **Run Act with the Token**:

```bash
# Using the token from .env file (via .actrc)
act -W .github/workflows/ci.yml

# Or specify directly
act -W .github/workflows/ci.yml -s GITHUB_TOKEN=your_personal_access_token
```

3. **Permissions**: For workflows that need to push to GitHub Container Registry or perform other privileged actions, ensure your PAT has the necessary permissions.

## Troubleshooting

### Common Issues

1. **"Unable to clone" errors**: These occur when Act tries to clone action repositories. Set a valid `GITHUB_TOKEN` or use `--actor` flag.

2. **Command not found errors**: The container might be missing required tools. Use a more complete base image or install tools in your workflow.

3. **Architecture errors**: Make sure you're using the `--container-architecture linux/amd64` flag.

4. **Timeout errors**: Increase the timeout with `--timeout` flag, e.g., `act --timeout 30`.

5. **Permission errors with private repositories**: Ensure your GitHub token has the necessary permissions for the operations you're trying to perform.

### Debugging

```bash
# Run with verbose output
act -v

# Run with debug output
act -d

# Run with specific event payload
act -e event.json
```

## Limitations

Act has some limitations, especially on macOS with Apple Silicon:

1. Not all GitHub Actions features are supported
2. Some actions might not work due to architecture differences
3. Performance might be slower than on GitHub's runners
4. Complex workflows with many dependencies might be difficult to run

For these cases, consider using the GitHub Actions sandbox approach described in the [testing-workflows.md](testing-workflows.md) document.
