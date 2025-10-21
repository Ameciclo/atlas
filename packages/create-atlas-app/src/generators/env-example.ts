import type { AppConfig } from "../create-app.js";

export function generateEnvExample(config: AppConfig): string {
	let content = `# Environment Configuration

# Node Environment
NODE_ENV=development

# Logging
LOG_LEVEL=info

# Server
PORT=${config.port}
`;

	if (config.includeDatabase) {
		content += `
# Database
DATABASE_URL=postgres://postgres:postgres@localhost:5432/${config.databaseName}

# Or use individual settings:
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=${config.databaseName}

# SSL Configuration
# Set to 'true' to enable SSL, or include '?sslmode=require' in DATABASE_URL
DB_SSL=false

# Optional: Path to SSL CA certificate for production databases
# DATABASE_SSL_CA=/path/to/ca-certificate.crt
`;
	}

	return content;
}
