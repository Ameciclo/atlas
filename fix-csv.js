const fs = require("fs");

// Ler o CSV e corrigir o JSON
const content = fs.readFileSync(
	"./apps/cycling-infra/src/db/ways.csv",
	"utf-8",
);

// Usar regex para encontrar e corrigir os JSONs
const fixedContent = content.replace(/"(\{[^}]+\})"/g, (match, jsonContent) => {
	// Corrigir aspas duplas escapadas
	const fixed = jsonContent.replace(/""/g, '"');
	return `"${fixed}"`;
});

// Salvar arquivo corrigido
fs.writeFileSync("./apps/cycling-infra/src/db/ways-fixed.csv", fixedContent);

console.log("✅ CSV corrigido salvo como ways-fixed.csv");

// Testar uma linha
const lines = fixedContent.split("\n");
const firstDataLine = lines[1];
const columns = [];
let current = "";
let inQuotes = false;

for (let i = 0; i < firstDataLine.length; i++) {
	const char = firstDataLine[i];

	if (char === '"') {
		inQuotes = !inQuotes;
	} else if (char === "," && !inQuotes) {
		columns.push(current.replace(/^"|"$/g, ""));
		current = "";
		continue;
	}
	current += char;
}
columns.push(current.replace(/^"|"$/g, ""));

console.log("Testando primeira linha:");
console.log("GeoJSON column (first 100 chars):", columns[7].substring(0, 100));

try {
	JSON.parse(columns[7]);
	console.log("✅ JSON válido!");
} catch (e) {
	console.log("❌ JSON ainda inválido:", e.message);
}
