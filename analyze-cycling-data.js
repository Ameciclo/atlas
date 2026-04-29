#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const dataDir = "./apps/cycling-infra/src/db";

function analyzeCSVStructure(filename, data) {
	const lines = data.split("\n").filter((line) => line.trim());
	const headers = lines[0].split(",");

	console.log(`📊 ${filename.toUpperCase()}:`);
	console.log(`- Registros: ${lines.length - 1}`);
	console.log(`- Campos (${headers.length}):`);

	headers.forEach((header, i) => {
		const values = lines
			.slice(1, 6)
			.map((line) => line.split(",")[i])
			.filter((v) => v);
		console.log(`  • ${header}: ${values.join(" | ")}`);
	});
	console.log();
}

function analyzeGeoJSONStructure(filename, data) {
	console.log(`🗺️  ${filename.toUpperCase()}:`);
	console.log(`- Features: ${data.features.length}`);

	// Analisar propriedades
	const propAnalysis = {};
	const geometryTypes = new Set();

	data.features.forEach((feature) => {
		geometryTypes.add(feature.geometry.type);

		Object.entries(feature.properties).forEach(([key, value]) => {
			if (!propAnalysis[key]) {
				propAnalysis[key] = { values: new Set(), count: 0, examples: [] };
			}
			propAnalysis[key].count++;
			if (value !== null && value !== undefined && value !== "") {
				propAnalysis[key].values.add(String(value));
				if (propAnalysis[key].examples.length < 3) {
					propAnalysis[key].examples.push(String(value));
				}
			}
		});
	});

	console.log(`- Geometrias: ${Array.from(geometryTypes).join(", ")}`);
	console.log("- Estrutura das propriedades:");

	Object.entries(propAnalysis)
		.sort(([, a], [, b]) => b.count - a.count)
		.forEach(([prop, info]) => {
			const coverage = ((info.count / data.features.length) * 100).toFixed(1);
			const uniqueValues = info.values.size;
			const examples = info.examples.slice(0, 3).join(" | ");

			console.log(`  • ${prop}:`);
			console.log(
				`    - Cobertura: ${coverage}% (${info.count}/${data.features.length})`,
			);
			console.log(`    - Valores únicos: ${uniqueValues}`);
			console.log(`    - Exemplos: ${examples}`);

			if (uniqueValues <= 20 && uniqueValues > 1) {
				console.log(
					`    - Todos os valores: ${Array.from(info.values).sort().join(", ")}`,
				);
			}
		});

	// Analisar geometrias
	console.log("\n- Análise por tipo de geometria:");
	geometryTypes.forEach((geomType) => {
		const features = data.features.filter((f) => f.geometry.type === geomType);
		const example = features[0];
		console.log(`  • ${geomType}: ${features.length} features`);
		console.log(
			`    - Exemplo coordenadas: ${JSON.stringify(example.geometry.coordinates).substring(0, 100)}...`,
		);
	});

	console.log();
}

console.log("🔍 ANÁLISE ESTRUTURAL DOS DADOS CYCLING-INFRA\n");

// Analisar cities.csv
const citiesData = fs.readFileSync(path.join(dataDir, "cities.csv"), "utf8");
analyzeCSVStructure("cities.csv", citiesData);

// Analisar relations.csv
const relationsData = fs.readFileSync(
	path.join(dataDir, "relations.csv"),
	"utf8",
);
analyzeCSVStructure("relations.csv", relationsData);

// Analisar ways.geojson
const waysData = JSON.parse(
	fs.readFileSync(path.join(dataDir, "ways.geojson"), "utf8"),
);
analyzeGeoJSONStructure("ways.geojson", waysData);

// Analisar ciclomapa.geojson
const ciclomapaData = JSON.parse(
	fs.readFileSync(
		path.join(dataDir, "ciclomapa-Recife, Pernambuco, Brasil.geojson"),
		"utf8",
	),
);
analyzeGeoJSONStructure("ciclomapa.geojson", ciclomapaData);
