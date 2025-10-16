import * as schema from "./table_pcr_street_names";
import { db, readCsv } from "../../utils";
import fs from "fs/promises";
import path from "path";
import { sql } from "drizzle-orm";
import { slugify } from "../../../commons/utils";

type PrefStreetInsert = {
  codlogradouro: number;
  nome_logradouro_concatenado: string;
  nome_oficial_logradouro: string;
  nome_logradouro_resumido: string;
  slug?: string;
  cod_indica_pavimentacao?: string;
  desc_indica_pavimentacao?: string;
  indica_corredor_transporte?: string;
  indica_perimetral?: string;
  codbairro?: number;
  nome_bairro?: string;
};

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function seedPCRStreetNames() {
  const data = await readCsv<PrefStreetInsert>(
    path.resolve(__dirname, "trechoslogradouro.csv")
  );

  const valid = data
    .filter(
      (r) =>
        r.codlogradouro != null &&
        r.nome_logradouro_concatenado &&
        r.nome_oficial_logradouro &&
        r.nome_logradouro_resumido
    )
    .map((r) => ({
      ...r,
      slug: slugify(r.nome_oficial_logradouro)
    }));

  const batches = chunkArray(valid, 1000);
  for (const batch of batches) {
    await db
      .insert(schema.pcr_street_names)
      .values(batch)
      .onConflictDoNothing()
      .execute();
    console.log(`✅ Inseridos ${batch.length} logradouros com slugs`);
  }
}

async function seedStreetGeoms() {
  console.log("🗺️ Processando geometrias dos logradouros...");
  const geojsonPath = path.resolve(__dirname, "trechos-de-logradouros.geojson");
  const content = await fs.readFile(geojsonPath, "utf-8");
  const geojson = JSON.parse(content);

  console.log(`📍 Preparando ${geojson.features.length} geometrias para batch update...`);
  
  // Criar tabela temporária
  await db.execute(sql`
    CREATE TEMP TABLE temp_geometries (
      codlogradouro INTEGER,
      geometry_json TEXT
    )
  `);
  
  // Preparar dados válidos
  const validGeoms = geojson.features
    .map((feature: any) => {
      const rawCode = feature.properties.CLOGRACODI;
      const code = typeof rawCode === "number" ? Math.round(rawCode) : parseInt(String(rawCode), 10);
      if (isNaN(code)) return null;
      return { codlogradouro: code, geometry_json: JSON.stringify(feature.geometry) };
    })
    .filter(Boolean);

  console.log(`📦 Inserindo ${validGeoms.length} geometrias na tabela temporária...`);
  
  // Inserir em batches na tabela temporária
  const batches = chunkArray(validGeoms, 1000);
  for (const batch of batches) {
    const values = batch.map((g: any) => `(${g.codlogradouro}, '${g.geometry_json.replace(/'/g, "''")}')`).join(',');
    await db.execute(sql.raw(`INSERT INTO temp_geometries VALUES ${values}`));
  }
  
  console.log(`🔄 Executando batch update das geometrias...`);
  
  // Fazer o update em uma única query
  await db.execute(sql`
    UPDATE ${schema.pcr_street_names}
    SET geom = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(temp_geometries.geometry_json), 4326))
    FROM temp_geometries
    WHERE ${schema.pcr_street_names}.codlogradouro = temp_geometries.codlogradouro
  `);
  
  console.log(`✅ ${validGeoms.length} geometrias atualizadas em batch!`);
}

// Orquestra as duas etapas de seed
export async function seedPCRStreets() {
  console.log("🛣️ Iniciando seed de logradouros PCR...");
  await seedPCRStreetNames();
  await seedStreetGeoms();
  console.log("✅ Seed de logradouros PCR concluído!");
}

// Se executado diretamente
if (require.main === module) {
  seedPCRStreets()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
