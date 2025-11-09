#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

// Função para encontrar todos os arquivos de rotas
function findRouteFiles(dir) {
	const files = [];
	const items = fs.readdirSync(dir);

	for (const item of items) {
		const fullPath = path.join(dir, item);
		const stat = fs.statSync(fullPath);

		if (stat.isDirectory() && item !== "node_modules") {
			files.push(...findRouteFiles(fullPath));
		} else if (item.endsWith(".ts") && fullPath.includes("/routes/")) {
			files.push(fullPath);
		}
	}

	return files;
}

// Função para extrair rotas OpenAPI de arquivos .routes.ts
function extractOpenApiRoutes(filePath) {
	const content = fs.readFileSync(filePath, "utf8");
	const routes = [];

	// Buscar por exports de createRoute
	const exportPattern =
		/export\s+const\s+(\w+)\s*=\s*createRoute\s*\(\s*\{[^}]*path:\s*['"`]([^'"`]*?)['"`][^}]*method:\s*['"`](\w+)['"`]/g;

	let match = exportPattern.exec(content);
	while (match !== null) {
		const [, exportName, path, method] = match;
		routes.push({
			exportName,
			path,
			method: method.toUpperCase(),
			file: filePath,
		});
		match = exportPattern.exec(content);
	}

	return routes;
}

// Função para extrair rotas do generate-openapi.ts
function extractGeneratorRoutes(generatorPath) {
	if (!fs.existsSync(generatorPath)) {
		return [];
	}

	const content = fs.readFileSync(generatorPath, "utf8");
	const routes = [];

	// Buscar por .openapi(routes.exportName, ...)
	const openapiPattern = /\.openapi\s*\(\s*(?:routes|analyticsRoutes)\.(\w+)/g;

	let match = openapiPattern.exec(content);
	while (match !== null) {
		routes.push(match[1]);
		match = openapiPattern.exec(content);
	}

	return routes;
}

// Função para gerar código para rotas faltantes
function generateMissingRouteCode(missingRoutes) {
	const routesByFile = {};

	for (const route of missingRoutes) {
		const fileName = path.basename(route.file, ".ts");
		if (!routesByFile[fileName]) {
			routesByFile[fileName] = [];
		}
		routesByFile[fileName].push(route);
	}

	console.log("\n📝 Código para adicionar no generate-openapi.ts:\n");

	// Imports
	const imports = Object.keys(routesByFile).map((fileName) => {
		if (fileName.includes("analytics")) {
			return `import * as analyticsRoutes from "./routes/cyclist-profiles/analytics.routes.js";`;
		} else {
			return `import * as ${fileName}Routes from "./routes/cyclist-profiles/${fileName}.routes.js";`;
		}
	});

	console.log("// Adicionar imports:");
	for (const imp of [...new Set(imports)]) {
		console.log(imp);
	}

	console.log("\n// Adicionar no createSpecApp():");

	for (const [fileName, routes] of Object.entries(routesByFile)) {
		const routerName = fileName.includes("analytics")
			? "analyticsRouter"
			: `${fileName}Router`;
		const importName = fileName.includes("analytics")
			? "analyticsRoutes"
			: `${fileName}Routes`;

		console.log(`\nconst ${routerName} = createRouter()`);
		for (const route of routes) {
			console.log(
				`\t// biome-ignore lint/suspicious/noExplicitAny: Dummy handlers for spec generation only`,
			);
			console.log(`\t.openapi(${importName}.${route.exportName}, null as any)`);
		}
		console.log(";");
	}

	console.log("\n// Adicionar no return:");
	const routerNames = Object.keys(routesByFile).map((fileName) =>
		fileName.includes("analytics") ? "analyticsRouter" : `${fileName}Router`,
	);

	for (const routerName of routerNames) {
		console.log(`\t.route("/v1/", ${routerName})`);
	}
}

// Função principal
function checkOpenApiCoverage() {
	console.log("🔍 Verificando cobertura das rotas OpenAPI...\n");

	const appsDir = path.join(__dirname, "..", "apps");
	const apps = fs
		.readdirSync(appsDir)
		.filter((item) => fs.statSync(path.join(appsDir, item)).isDirectory());

	for (const app of apps) {
		const appPath = path.join(appsDir, app);
		const generatorPath = path.join(appPath, "src", "generate-openapi.ts");

		console.log(`📱 Verificando app: ${app}`);
		console.log(
			`📄 generate-openapi.ts: ${fs.existsSync(generatorPath) ? "✅" : "❌"}`,
		);

		if (!fs.existsSync(generatorPath)) {
			console.log("⚠️  Sem gerador OpenAPI\n");
			continue;
		}

		// Encontrar arquivos .routes.ts
		const routeFiles = findRouteFiles(appPath).filter((file) =>
			file.endsWith(".routes.ts"),
		);
		console.log(`📁 Arquivos .routes.ts encontrados: ${routeFiles.length}`);

		// Extrair todas as rotas OpenAPI definidas
		const allDefinedRoutes = [];
		for (const file of routeFiles) {
			const routes = extractOpenApiRoutes(file);
			allDefinedRoutes.push(...routes);
		}

		// Extrair rotas registradas no gerador
		const registeredRoutes = extractGeneratorRoutes(generatorPath);

		console.log(`🛣️  Rotas OpenAPI definidas: ${allDefinedRoutes.length}`);
		console.log(`📋 Rotas no gerador: ${registeredRoutes.length}`);

		// Mostrar rotas definidas
		if (allDefinedRoutes.length > 0) {
			console.log("\n📝 Rotas OpenAPI definidas:");
			for (const route of allDefinedRoutes) {
				const status = registeredRoutes.includes(route.exportName)
					? "✅"
					: "❌";
				console.log(
					`   ${status} ${route.method} ${route.path} (${route.exportName})`,
				);
			}
		}

		// Verificar rotas faltantes
		const missingRoutes = allDefinedRoutes.filter(
			(route) => !registeredRoutes.includes(route.exportName),
		);

		if (missingRoutes.length > 0) {
			console.log(
				`\n❌ Rotas não registradas no gerador (${missingRoutes.length}):`,
			);
			for (const route of missingRoutes) {
				console.log(`   ${route.method} ${route.path} (${route.exportName})`);
				console.log(`     📁 ${route.file.replace(process.cwd(), ".")}`);
			}

			generateMissingRouteCode(missingRoutes);
		} else if (allDefinedRoutes.length > 0) {
			console.log("\n✅ Todas as rotas OpenAPI estão registradas no gerador!");
		}

		console.log(`\n${"=".repeat(70)}\n`);
	}
}

checkOpenApiCoverage();
