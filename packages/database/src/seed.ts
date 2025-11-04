import { join } from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import * as dotenv from "dotenv";
import { seedCyclistCounts } from "./seed-cyclist-counts.js";
import { seedCyclistProfiles } from "./seed-cyclist-profiles.js";
import { seedTrafficDeaths } from "./seed-traffic-deaths.js";

// Load environment variables from .env.local first, then .env
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = __dirname.replace("/packages/database/src", "");
dotenv.config({ path: join(rootDir, ".env.local") });
dotenv.config({ path: join(rootDir, ".env") });

interface SeedResult {
	name: string;
	success: boolean;
	duration: number;
	details: Record<string, unknown>;
	error?: string;
}

interface SeedOptions {
	only?: string[];
	skip?: string[];
}

/**
 * Parse command-line arguments
 * Supports: --only=counts,profiles --skip=deaths
 */
function parseArgs(): SeedOptions {
	const args = process.argv.slice(2);
	const options: SeedOptions = {};

	for (const arg of args) {
		if (arg.startsWith("--only=")) {
			options.only = arg
				.slice(7)
				.split(",")
				.map((s) => s.trim());
		} else if (arg.startsWith("--skip=")) {
			options.skip = arg
				.slice(7)
				.split(",")
				.map((s) => s.trim());
		}
	}

	return options;
}

/**
 * Master seed orchestrator
 * Runs all seed scripts in sequence with proper error handling and reporting
 * Options:
 *   --only=counts,profiles  Run only specific seeds
 *   --skip=deaths           Skip specific seeds
 */
async function masterSeed(options: SeedOptions = {}) {
	// Beautiful header with gradient effect
	console.log("\n");
	console.log(chalk.cyan("╔") + chalk.cyan("═".repeat(62)) + chalk.cyan("╗"));
	console.log(
		chalk.cyan("║") +
			chalk.bold.cyan("          🌱 ATLAS DATABASE MASTER SEED 🌱          ") +
			chalk.cyan("║"),
	);
	console.log(
		chalk.cyan("║") +
			chalk.gray("         Orchestrating all database seeds...         ") +
			chalk.cyan("║"),
	);
	console.log(chalk.cyan("╚") + chalk.cyan("═".repeat(62)) + chalk.cyan("╝"));
	console.log("\n");

	const results: SeedResult[] = [];
	const startTime = Date.now();

	// Define seed tasks in order
	const seedTasks = [
		{
			name: "Cyclist Counts",
			id: "counts",
			icon: "🚴",
			color: chalk.yellow,
			fn: seedCyclistCounts,
		},
		{
			name: "Cyclist Profiles",
			id: "profiles",
			icon: "👤",
			color: chalk.blue,
			fn: seedCyclistProfiles,
		},
		{
			name: "Traffic Deaths",
			id: "deaths",
			icon: "🚗",
			color: chalk.red,
			fn: seedTrafficDeaths,
		},
	];

	// Filter tasks based on options
	let tasksToRun = seedTasks;

	if (options.only && options.only.length > 0) {
		const onlyIds = options.only;
		tasksToRun = seedTasks.filter((task) => onlyIds.includes(task.id));
	}

	if (options.skip && options.skip.length > 0) {
		const skipIds = options.skip;
		tasksToRun = tasksToRun.filter((task) => !skipIds.includes(task.id));
	}

	// Show which seeds are being run
	if (options.only || options.skip) {
		console.log(
			chalk.gray("Running seeds: ") +
				chalk.cyan(tasksToRun.map((t) => t.id).join(", ")),
		);
		console.log("\n");
	}

	// Execute each seed task
	for (const task of tasksToRun) {
		const taskStartTime = Date.now();

		// Task header
		console.log(task.color(`${task.icon} ${task.name}`));
		console.log(task.color("─".repeat(64)));

		try {
			const details = await task.fn();
			const duration = Date.now() - taskStartTime;

			results.push({
				name: task.name,
				success: true,
				duration,
				details: details || {},
			});

			const durationStr = (duration / 1000).toFixed(2);
			console.log(
				chalk.green(`✅ Completed in ${durationStr}s`) +
					chalk.gray(" • ") +
					chalk.dim("All records processed"),
			);
			console.log("\n");
		} catch (error) {
			const duration = Date.now() - taskStartTime;
			const errorMessage =
				error instanceof Error ? error.message : String(error);

			results.push({
				name: task.name,
				success: false,
				duration,
				details: {},
				error: errorMessage,
			});

			console.error(chalk.red(`❌ Failed in ${(duration / 1000).toFixed(2)}s`));
			console.error(chalk.red(`   Error: ${errorMessage}\n`));
		}
	}

	// Print summary report
	const totalDuration = Date.now() - startTime;
	const successCount = results.filter((r) => r.success).length;
	const failureCount = results.filter((r) => !r.success).length;

	console.log(
		chalk.magenta("╔") + chalk.magenta("═".repeat(62)) + chalk.magenta("╗"),
	);
	console.log(
		chalk.magenta("║") +
			chalk.bold.magenta(
				"              📊 SEED SUMMARY REPORT 📊              ",
			) +
			chalk.magenta("║"),
	);
	console.log(
		chalk.magenta("╚") + chalk.magenta("═".repeat(62)) + chalk.magenta("╝"),
	);
	console.log("\n");

	for (const result of results) {
		const status = result.success ? chalk.green("✅") : chalk.red("❌");
		const duration = (result.duration / 1000).toFixed(2);
		const nameCol = result.name.padEnd(20);

		const statusLine =
			status +
			chalk.gray(" │ ") +
			(result.success ? chalk.cyan(nameCol) : chalk.red(nameCol)) +
			chalk.gray(" │ ") +
			chalk.bold(`${duration}s`);

		console.log(statusLine);

		if (result.success && Object.keys(result.details).length > 0) {
			for (const [key, value] of Object.entries(result.details)) {
				console.log(chalk.gray(`   └─ ${key}: `) + chalk.cyan(String(value)));
			}
		}

		if (result.error) {
			console.log(chalk.red(`   └─ Error: ${result.error}`));
		}
	}

	console.log(`\n${chalk.gray("─".repeat(64))}`);
	console.log(
		chalk.bold(
			`Total: ${chalk.green(`${successCount} succeeded`)}, ${failureCount > 0 ? chalk.red(`${failureCount} failed`) : chalk.green("0 failed")}`,
		),
	);
	console.log(
		chalk.bold(`Total time: ${chalk.cyan((totalDuration / 1000).toFixed(2))}s`),
	);
	console.log(`${chalk.gray("─".repeat(64))}\n`);

	// Exit with appropriate code
	if (failureCount > 0) {
		console.error(chalk.red.bold("❌ Seeding completed with errors!"));
		process.exit(1);
	}

	console.log(chalk.green.bold("🎉 All seeds completed successfully!"));
	console.log(chalk.dim("Database is ready for use.\n"));
	process.exit(0);
}

// Run master seed
const options = parseArgs();
masterSeed(options).catch((error) => {
	console.error("❌ Fatal error in master seed:", error);
	process.exit(1);
});
