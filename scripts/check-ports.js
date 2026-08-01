#!/usr/bin/env node

const net = require("node:net");

const ports = [
	3000, 3002, 3003, 3005, 3010, 3015, 3016, 3019, 3020, 3050,
];
const services = {
	3000: "cyclist-profile",
	3002: "cyclist-counts",
	3003: "traffic-deaths",
	3005: "bicycle-racks",
	3010: "emergency-calls",
	3015: "shared-bike",
	3016: "pcr-streets",
	3019: "traffic-calls",
	3020: "cycling-infra",
	3050: "ciclodados",
};

function checkPort(port) {
	return new Promise((resolve) => {
		const socket = new net.Socket();

		socket.setTimeout(1000);

		socket.on("connect", () => {
			socket.destroy();
			resolve(true);
		});

		socket.on("timeout", () => {
			socket.destroy();
			resolve(false);
		});

		socket.on("error", () => {
			resolve(false);
		});

		socket.connect(port, "localhost");
	});
}

async function main() {
	console.log("🔍 Checking which ports are open...\n");

	const results = await Promise.all(
		ports.map(async (port) => {
			const isOpen = await checkPort(port);
			const service = services[port];
			const status = isOpen ? "✅" : "❌";
			console.log(
				`${status} Port ${port} (${service}): ${isOpen ? "OPEN" : "CLOSED"}`,
			);
			return { port, service, isOpen };
		}),
	);

	const openPorts = results.filter((r) => r.isOpen);
	console.log(`\n📊 ${openPorts.length}/${ports.length} services are running`);

	if (openPorts.length > 0) {
		console.log("\n🚀 Running services:");
		openPorts.forEach(({ port, service }) => {
			console.log(`  • ${service} on http://localhost:${port}`);
		});
	}
}

main().catch(console.error);
