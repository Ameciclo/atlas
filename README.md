# Atlas Project

[![][GitHubStars]][GitHubRepo]
[![][GitHubLicense]][GitHubLicenseUrl]

**A monorepo for [brief description of what Atlas is/does]**

## Overview

This monorepo utilizes pnpm and Turbo for efficient development, building, and deployment of various applications and packages.  It provides a standardized and maintainable environment for all projects within the Atlas ecosystem.

## Technologies

*   **Monorepo Management:** pnpm (https://pnpm.io/)
*   **Build System & Caching:** Turbo (https://turbo.build/)
*   **Languages:** TypeScript, JavaScript (and potentially others within individual packages/apps)
*   **Frameworks:** [List frameworks used - e.g., React, Next.js, Node.js, etc. Be specific]

## Requirements

- Node.js 22.15.0
- pnpm 10.10.0

We recommend using [mise](https://mise.jdx.dev/) for managing tool versions. A `.tool-versions` file is included in the repository.

## Getting Started

1.  **Clone the Repository:**
    ```bash
    git clone [Your Git Repository URL]
    ```

2.  **Install Dependencies:**
    ```bash
    pnpm install
    ```

3.  **Development:**
    *   Navigate to the directory of the application/package you want to develop.
    *   Run `pnpm dev` to start the development server.

4.  **Building:**
    *   Run `pnpm build` to build all applications/packages.

5.  **Testing:**
    *   Run `pnpm test` to execute the test suite.

## Directory Structure

```
atlas/
├── apps/                # Applications
│   ├── docs/            # Documentation site
│   └── cyclist-profile/ # Cyclist profile service
├── packages/            # Shared packages
│   └── typescript-config/ # Shared TypeScript configuration
├── turbo.json           # Turborepo configuration
└── pnpm-workspace.yaml  # PNPM workspace configuration
```

## CI/CD Pipeline

The CI/CD pipeline is configured to be intelligent and efficient:

1. **Smart Dependency Detection**: Uses Turborepo's `--filter` feature to only build and test packages that have changed or are affected by changes.

2. **Efficient Docker Builds**:
   - Uses `turbo prune` to create minimal Docker build contexts
   - Only builds Docker images for applications that have changed
   - Pushes images to GitHub Container Registry (ghcr.io)

3. **Deployment**:
   - Docker images are deployed using Portainer
   - Each application can be deployed independently
   - Database migrations and seeding are handled by reusing the same Docker image with different commands

### Using Turbo Prune

For efficient Docker builds, we use `turbo prune` to create a subset of the monorepo with only the packages needed for a specific application:

```bash
# Example: Prune the monorepo for the cyclist-profile app
npx turbo prune --scope=@atlas/cyclist-profile --docker
```

This creates an `out` directory with:
- `out/json/`: Package JSON files
- `out/full/`: Source code for the app and its dependencies
- `out/pnpm-lock.yaml`: Pruned lockfile
- `out/pnpm-workspace.yaml`: Pruned workspace config

## Contributing

[Add information about contributing to the project.  Include guidelines, code of conduct, etc.]

## License

[Specify the license under which the project is released.  Add a link to the license file.]

---

[GitHubStars]: https://img.shields.io/github/stars/YourUsername/YourRepo
[GitHubLicense]: https://img.shields.io/github/license/YourUsername/YourRepo
[GitHubLicenseUrl]: [Your License URL]
[GitHubRepo]: [Your Repository URL]
