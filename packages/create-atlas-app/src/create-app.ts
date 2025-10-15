import path from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import fs from "fs-extra";
import ora from "ora";
import prompts from "prompts";
import { generateFiles } from "./generators/index.js";
import { toKebabCase, toPascalCase, validateAppName } from "./utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AppConfig {
	name: string;
	displayName: string;
	description: string;
	port: number;
	includeDatabase: boolean;
	databaseName?: string;
}

export async function createApp() {
	console.log(chalk.blue.bold("\n🚀 Create Atlas App\n"));

	// Get app name from command line or prompt
	const appNameArg = process.argv[2];

	const response = await prompts(
		[
			{
				type: appNameArg ? null : "text",
				name: "name",
				message: "What is the name of your app?",
				initial: "my-service",
				validate: (value: string) => {
					const validation = validateAppName(value);
					return validation.valid || validation.error || "Invalid name";
				},
			},
			{
				type: "text",
				name: "description",
				message: "App description:",
				initial: (prev: string) =>
					`API service for ${prev || appNameArg || "my-service"}`,
			},
			{
				type: "number",
				name: "port",
				message: "Default port:",
				initial: 3000,
				validate: (value: number) =>
					value > 0 && value < 65536 ? true : "Port must be between 1-65535",
			},
			{
				type: "confirm",
				name: "includeDatabase",
				message: "Include PostgreSQL database setup?",
				initial: true,
			},
			{
				type: (prev: boolean) => (prev ? "text" : null),
				name: "databaseName",
				message: "Database name:",
				initial: (_prev: unknown, values: { name?: string }) =>
					`${toKebabCase(values.name || appNameArg || "my-service")}_db`,
			},
		],
		{
			onCancel: () => {
				console.log(chalk.red("\n✖ Operation cancelled"));
				process.exit(0);
			},
		},
	);

	const appName = appNameArg || response.name;
	const config: AppConfig = {
		name: toKebabCase(appName),
		displayName: toPascalCase(appName),
		description: response.description,
		port: response.port,
		includeDatabase: response.includeDatabase,
		databaseName: response.databaseName,
	};

	const appPath = path.join(process.cwd(), "apps", config.name);

	// Check if app already exists
	if (await fs.pathExists(appPath)) {
		console.log(
			chalk.red(`\n✖ App "${config.name}" already exists at ${appPath}`),
		);
		process.exit(1);
	}

	console.log(chalk.cyan(`\n📦 Creating app: ${config.name}\n`));

	const spinner = ora("Generating files...").start();

	try {
		// Create app directory
		await fs.ensureDir(appPath);

		// Generate all files
		await generateFiles(appPath, config);

		spinner.succeed("Files generated");

		// Show success message
		console.log(chalk.green.bold("\n✓ App created successfully!\n"));
		console.log(chalk.cyan("Next steps:\n"));
		console.log(chalk.white("  1. Install dependencies:"));
		console.log(chalk.gray("     pnpm install\n"));
		console.log(chalk.white("  2. Start development server:"));
		console.log(chalk.gray(`     pnpm --filter @atlas/${config.name} dev\n`));

		if (config.includeDatabase) {
			console.log(chalk.white("  3. Run database migrations:"));
			console.log(
				chalk.gray(`     pnpm --filter @atlas/${config.name} db:migrate\n`),
			);
		}

		console.log(chalk.white("  4. Open in browser:"));
		console.log(chalk.gray(`     http://localhost:${config.port}\n`));

		console.log(chalk.yellow("📚 Documentation:"));
		console.log(chalk.gray(`   - App README: apps/${config.name}/README.md`));
		console.log(
			chalk.gray(
				"   - Inter-service communication: docs/INTER_SERVICE_COMMUNICATION.md\n",
			),
		);
	} catch (error) {
		spinner.fail("Failed to generate files");
		throw error;
	}
}
