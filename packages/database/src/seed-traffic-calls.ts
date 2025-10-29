import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import type { DatabaseConfig } from "./connection.js";
import { closeDatabase, createConnectedDatabase } from "./connection.js";
import * as trafficCallsSchema from "./schemas/traffic-calls/index.js";

interface CsvRow {
	data: string;
	hora: string;
	natureza_acidente: string;
	situacao: string;
	bairro: string;
	endereco: string;
	numero: string;
	detalhe_endereco_acidente: string;
	complemento: string;
	endereco_cruzamento: string;
	numero_cruzamento: string;
	referencia_cruzamento: string;
	bairro_cruzamento: string;
	tipo: string;
	descricao: string;
	auto: string;
	moto: string;
	ciclom: string;
	ciclista: string;
	pedestre: string;
	onibus: string;
	caminhao: string;
	viatura: string;
	outros: string;
	vitimas: string;
	vitimasfatais: string;
	num_semaforo: string;
	sentido_via: string;
	acidente_verificado: string;
	tempo_clima: string;
	situacao_semaforo: string;
	sinalizacao: string;
	condicao_via: string;
	conservacao_via: string;
	ponto_controle: string;
	situacao_placa: string;
	velocidade_max_via: string;
	mao_direcao: string;
	divisao_via1: string;
	divisao_via2: string;
	divisao_via3: string;
	_id: string;
	Protocolo: string;
}



function buildDateTime(dateStr: string, timeStr: string): Date {
	const [year, month, day] = dateStr.split('-');
	const [hour, minute, second] = timeStr.split(':');
	return new Date(
		parseInt(year),
		parseInt(month) - 1,
		parseInt(day),
		parseInt(hour),
		parseInt(minute),
		parseInt(second || '0')
	);
}

function parseNumber(str: string): number {
	if (!str || str.trim() === '') return 0;
	const num = parseInt(str.trim());
	return isNaN(num) ? 0 : num;
}

/**
 * Seed traffic crashes data from CSV file
 */
export async function seedTrafficCalls(config: DatabaseConfig = {}) {
	const db = await createConnectedDatabase(config);

	try {
		console.log("🌱 Starting traffic crashes seed...");

		// Load and parse CSV data
		const dataPath = join(
			import.meta.dirname,
			"../../../apps/traffic-calls/src/db/sinistros-cttu-2016-2024-vias-corrigidas.csv",
		);
		const rawData = await readFile(dataPath, "utf-8");
		
		// Parse CSV with proper library
		const records = parse(rawData, {
			columns: [
				'data', 'hora', 'natureza_acidente', 'situacao', 'bairro', 'endereco', '',
				'numero', 'detalhe_endereco_acidente', 'complemento', 'endereco_cruzamento',
				'numero_cruzamento', 'referencia_cruzamento', 'bairro_cruzamento', 'tipo',
				'descricao', 'auto', 'moto', 'ciclom', 'ciclista', 'pedestre', 'onibus',
				'caminhao', 'viatura', 'outros', 'vitimas', 'vitimasfatais', 'num_semaforo',
				'sentido_via', 'acidente_verificado', 'tempo_clima', 'situacao_semaforo',
				'sinalizacao', 'condicao_via', 'conservacao_via', 'ponto_controle',
				'situacao_placa', 'velocidade_max_via', 'mao_direcao', 'divisao_via1',
				'divisao_via2', 'divisao_via3', '_id', 'Protocolo'
			],
			skip_empty_lines: true,
			from_line: 2 // Skip header
		}) as CsvRow[];
		
		console.log(`📊 Found ${records.length} crashes to import`);

		let crashesCreated = 0;
		const batchSize = 1000;

		for (let i = 0; i < records.length; i += batchSize) {
			const batch = records.slice(i, i + batchSize);
			const crashData: typeof trafficCallsSchema.trafficCalls.$inferInsert[] = [];

			for (const row of batch) {
				try {

					// Skip if not FINALIZADA
					if (row.situacao !== 'FINALIZADA') {
						continue;
					}

					const datetime = buildDateTime(row.data, row.hora);
					// Use the actual values from CSV columns
					const nonFatalVictims = parseNumber(row.vitimas);
					const fatalVictims = parseNumber(row.vitimasfatais);
					const totalVictims = nonFatalVictims + fatalVictims;

					const crashRecord: typeof trafficCallsSchema.trafficCalls.$inferInsert = {
						datetime,
						nature: row.natureza_acidente,
						total_victims: totalVictims,
						injured_victims: nonFatalVictims,
						fatal_victims: fatalVictims,
						street_name: row.endereco,
						neighborhood: row.bairro,
						coordinates: null, // Will be handled later with PostGIS
						crash_data: {
							type: row.tipo,
							description: row.descricao,
							address: row.endereco,
							vehicles: {
								cars: parseNumber(row.auto),
								motorcycles: parseNumber(row.moto),
								bicycles: parseNumber(row.ciclom),
								cyclists: parseNumber(row.ciclista),
								pedestrians: parseNumber(row.pedestre),
								buses: parseNumber(row.onibus),
								trucks: parseNumber(row.caminhao),
								police_vehicles: parseNumber(row.viatura),
								others: parseNumber(row.outros),
							}
						},
						environmental_data: {
							weather: row.tempo_clima,
							traffic_light_status: row.situacao_semaforo,
							signage: row.sinalizacao,
							road_conditions: row.condicao_via,
							road_conservation: row.conservacao_via,
							max_speed: row.velocidade_max_via,
						},
						metadata: {
							original_id: row._id,
							protocol: row.Protocolo,
							verified: row.acidente_verificado === 'SIM',
						}
					};

					crashData.push(crashRecord);
				} catch (error) {
					console.warn(`⚠️ Skipping invalid row: ${error}`);
				}
			}

			if (crashData.length > 0) {
				await db.insert(trafficCallsSchema.trafficCalls).values(crashData);
				crashesCreated += crashData.length;
				console.log(`  ✓ Processed batch ${Math.floor(i / batchSize) + 1}: ${crashData.length} crashes`);
			}
		}

		console.log("\n✅ Seed completed successfully!");
		console.log(`   🚗 Traffic crashes: ${crashesCreated} created`);
	} catch (error) {
		console.error("❌ Error seeding data:", error);
		throw error;
	} finally {
		await closeDatabase(db);
	}
}

/**
 * CLI entry point for running seed
 */
if (import.meta.url === `file://${process.argv[1]}`) {
	seedTrafficCalls().catch((error) => {
		console.error("Seed failed:", error);
		process.exit(1);
	});
}