import "dotenv/config";

async function main() {
	console.log("Seed pipeline\n");

	const { seedInfractionCatalog } = await import("./seed-catalog.js");
	await seedInfractionCatalog();

	console.log("Seed complete.\n");
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("Seed failed:", err);
		process.exit(1);
	});
