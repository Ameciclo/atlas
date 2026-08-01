#!/usr/bin/env node

const services = [
	{ name: "cyclist-profile", port: 3000 },
	{ name: "cyclist-counts", port: 3002 },
	{ name: "shared-bike", port: 3015 },
	{ name: "traffic-deaths", port: 3003 },
	{ name: "bicycle-racks", port: 3005 },
	{ name: "cycling-infra", port: 3020 },
	{ name: "emergency-calls", port: 3010 },
	{ name: "traffic-calls", port: 3019 },
];

async function testHealth(service) {
	const url = `http://localhost:${service.port}/health`;
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 3000);

		const response = await fetch(url, { signal: controller.signal });
		clearTimeout(timeoutId);

		const status = response.ok ? "✅" : "❌";
		const statusText = response.ok
			? "OK"
			: `${response.status} ${response.statusText}`;
		console.log(`${status} ${service.name} (${service.port}): ${statusText}`);

		if (response.ok) {
			const data = await response.text();
			console.log(
				`    Response: ${data.substring(0, 100)}${data.length > 100 ? "..." : ""}`,
			);
		}

		return response.ok;
	} catch (_error) {
		console.log(`❌ ${service.name} (${service.port}): Connection failed`);
		return false;
	}
}

async function main() {
	console.log("🏥 Testing /health endpoints...\n");

	let working = 0;
	for (const service of services) {
		const success = await testHealth(service);
		if (success) working++;
	}

	console.log(`\n📊 ${working}/${services.length} health endpoints working`);
}

main().catch(console.error);
