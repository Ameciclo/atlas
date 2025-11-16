import type { AppConfig } from "../create-app.js";

export function generateGitignore(_config: AppConfig): string {
	return `# Environment variables
.env
.env.local
.env.*.local

# Build output
dist/
*.tsbuildinfo

# CSV data files (large files)
*.csv

# OpenAPI spec (generated)
openapi.json`;
}
