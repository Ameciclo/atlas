// src/modules/traffic-crashes/geojson.ts
import express, { Request, Response } from "express";
import { db } from "../../db";
import { sql } from "drizzle-orm";
import { cttu_crashes } from "../../db/schema";
import { pcr_street_names } from "../../db/modules/global/table_pcr_street_names";

const router = express.Router();

router.get("/", async (_req: Request, res: Response) => {
  console.log("Rodadno GEOJSON");
  try {
    const rows = await db
      .select({
        id: pcr_street_names.id,
        nome_oficial: pcr_street_names.nome_oficial_logradouro,
        total_colisoes: sql<number>`COUNT(${cttu_crashes.id})`,
        total_vitimas: sql<number>`SUM(${cttu_crashes.vitimas})`,
        geom: sql<string>`ST_AsGeoJSON(${pcr_street_names.geom})`,
      })
      .from(pcr_street_names)
      .leftJoin(
        cttu_crashes,
        sql`${cttu_crashes.street_id} = ${pcr_street_names.id}`
      )
      .where(sql`${pcr_street_names.geom} IS NOT NULL`)
      .groupBy(pcr_street_names.id)
      .execute();

    const features = rows
      .filter((r) => r.geom)
      .map((row) => ({
        type: "Feature",
        geometry: JSON.parse(row.geom),
        properties: {
          id: row.id,
          nome: row.nome_oficial,
          colisoes: Number(row.total_colisoes ?? 0),
          vitimas: Number(row.total_vitimas ?? 0),
        },
      }));

    res.json({ type: "FeatureCollection", features });
  } catch (err) {
    console.error("Erro ao gerar GeoJSON:", err);
    res.status(500).json({ error: "Erro interno ao gerar GeoJSON" });
  }
});

export default router;
