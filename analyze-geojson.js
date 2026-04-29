const fs = require("node:fs");
const path = require("node:path");

function parseCSV(content) {
	const lines = [];
	let currentLine = "";
	let inQuotes = false;

	for (let i = 0; i < content.length; i++) {
		const char = content[i];

		if (char === '"') {
			inQuotes = !inQuotes;
		}

		if (char === "\n" && !inQuotes) {
			lines.push(currentLine.trim());
			currentLine = "";
		} else {
			currentLine += char;
		}
	}

	if (currentLine.trim()) {
		lines.push(currentLine.trim());
	}

	const headers =
		lines[0]?.split(",").map((h) => h.replace(/"/g, "").trim()) || [];

	return lines
		.slice(1)
		.filter((line) => line.trim())
		.map((line) => {
			const values = [];
			let currentValue = "";
			let inQuotes = false;

			for (let i = 0; i < line.length; i++) {
				const char = line[i];

				if (char === '"') {
					inQuotes = !inQuotes;
				} else if (char === "," && !inQuotes) {
					values.push(currentValue.replace(/"/g, "").trim());
					currentValue = "";
				} else {
					currentValue += char;
				}
			}

			values.push(currentValue.replace(/"/g, "").trim());

			const row = {};
			headers.forEach((header, i) => {
				row[header] = values[i] || "";
			});
			return row;
		});
}

const csvPath = path.join(__dirname, "apps/cycling-infra/src/db/ways.csv");
const content = fs.readFileSync(csvPath, "utf-8");
const data = parseCSV(content);

console.log("Total rows:", data.length);
console.log("Sample geojson field (first 200 chars):");
console.log(data[0].geojson.substring(0, 200));
console.log("\n---\n");

// Test parsing
let validCount = 0;
let invalidCount = 0;
const errors = [];

data.slice(0, 10).forEach((row, i) => {
	try {
		if (row.geojson?.trim()) {
			// Try different fixes
			let fixedJson = row.geojson;

			// Fix double quotes
			if (fixedJson.includes('""')) {
				fixedJson = fixedJson.replace(/""/g, '"');
			}

			JSON.parse(fixedJson);
			validCount++;
			console.log(`✅ Row ${i}: Valid JSON`);
		}
	} catch (e) {
		invalidCount++;
		errors.push({ row: i, osm_id: row.osm_id, error: e.message });
		console.log(`❌ Row ${i} (${row.osm_id}): ${e.message}`);
		console.log(`   First 100 chars: ${row.geojson.substring(0, 100)}`);
	}
});

console.log(`\nSummary: ${validCount} valid, ${invalidCount} invalid`);
