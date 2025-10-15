#!/usr/bin/env node

import { createApp } from "./create-app.js";

async function main() {
	try {
		await createApp();
	} catch (error) {
		console.error("Error creating app:", error);
		process.exit(1);
	}
}

main();
