import "dotenv/config";

async function main() {
	console.log("🚀 Running full seed pipeline...\n");

	console.log("── Step 1: Seed violation_categories ──\n");
	const { seed } = await import("./seed-violation-categories.js");
	await seed();

	console.log("── Step 2: Seed & apply description_corrections ──\n");
	const { seedAndApply } = await import("./seed-description-corrections.js");
	await seedAndApply();

	console.log("✅ Full seed pipeline complete.\n");
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("Seed pipeline failed:", err);
		process.exit(1);
	});
