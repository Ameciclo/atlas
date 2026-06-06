import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "./index.js";

async function main() {
	const rows = await db.execute(`
		SELECT DISTINCT cttu_code, MAX(law_code) as law_code, description
		FROM traffic_violations
		GROUP BY cttu_code, description
		ORDER BY cttu_code, description
	`);

	const data = (rows as any).rows || rows;

	let csv = "cttu_code,law_code,description\n";
	for (const r of data) {
		const code = r.cttu_code;
		const law = (r.law_code as string).replace(/"/g, '""');
		const desc = (r.description as string).replace(/"/g, '""');
		csv += `"${code}","${law}","${desc}"\n`;
	}

	const path = join(import.meta.dirname, "../../src/db/descricoes_infracoes.csv");
	await writeFile(path, csv, "utf-8");

	console.log(`✅ CSV gerado: ${path}`);
	console.log(`   ${data.length} pares únicos (cttu_code + description)`);
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("Failed:", err);
		process.exit(1);
	});
