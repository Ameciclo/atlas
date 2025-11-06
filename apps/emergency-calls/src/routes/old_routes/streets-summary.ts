// src/modules/traffic-crashes/streets-summary.ts
import express, { Request, Response } from "express";
import { db } from "../../db";
import { cttu_crashes } from "../../db/modules/casualties/table_cttu_crashes";
import * as streets from "../../db/modules/global/table_pcr_street_names";
import { cities } from "../../db/modules/global/table_cities";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";

const RECIFE_CITY_ID = 2611606;

const router = express.Router();

/**
 * GET /api/crashes/streets-summary?year=YYYY&cityId=ID
 * Retorna lista de vias (prefeitura ou texto bruto) com totais de sinistros e sinistros fatais
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const yearParam = req.query.year;
    const cityIdParam = req.query.cityId;
    const year = yearParam ? parseInt(String(yearParam), 10) : null;
    const cityId = cityIdParam ? parseInt(String(cityIdParam), 10) : RECIFE_CITY_ID;
    
    let whereConditions = [];
    
    if (year) {
      whereConditions.push(sql`date_part('year', ${cttu_crashes.data}) = ${year}`);
    }
    
    // Filtro por cidade através das ruas
    whereConditions.push(sql`${streets.pcr_street_names.id} IN (
      SELECT DISTINCT street_id 
      FROM casualties.samu_calls 
      WHERE city_id = ${cityId} AND street_id IS NOT NULL
    )`);
    
    const whereClause = whereConditions.length > 0 
      ? whereConditions.reduce((acc, condition) => sql`${acc} AND ${condition}`, sql`1=1`)
      : sql`1=1`;

    const rows = await db
      .select({
        streetId: cttu_crashes.street_id,
        name: sql<string>`
          COALESCE(
            ${streets.pcr_street_names.nome_logradouro_concatenado},
            ${cttu_crashes.endereco}
          )
        `,
        totalSinistros: sql<string>`COUNT(*)`,
        totalFatais: sql<string>`SUM(${cttu_crashes.vitimas_fat})`,
      })
      .from(cttu_crashes)
      .leftJoin(
        streets.pcr_street_names,
        eq(cttu_crashes.street_id, streets.pcr_street_names.id)
      )
      .where(whereClause)
      .groupBy(
        cttu_crashes.street_id,
        streets.pcr_street_names.nome_logradouro_concatenado,
        cttu_crashes.endereco
      )
      .orderBy(sql`COUNT(*) DESC`)
      .execute();

    const result = rows.map((r) => ({
      streetId: r.streetId,
      name: r.name,
      totalSinistros: parseInt(r.totalSinistros, 10),
      totalFatais: parseInt(r.totalFatais, 10) || 0,
    }));

    res.json({
      data: result,
      filters: {
        year: year || "todos",
        cityId: cityId,
        cityName: cityId === RECIFE_CITY_ID ? "Recife" : "Cidade ID " + cityId
      },
      total: result.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
