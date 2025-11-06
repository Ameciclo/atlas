import { Hono } from "hono";
import { db } from "../../db";
import { cttu_crashes } from "../../db/schema";
import { sql } from "drizzle-orm";

const app = new Hono();

app.get("/", async (c) => {
  try {
    // Total de sinistros
    const totalRes = await db
      .select({ total: sql<number>`count(*)` })
      .from(cttu_crashes)
      .execute();
    const totalSinistros = Number(totalRes[0].total);

    // Somas de vítimas
    const vitRes = await db
      .select({
        vitimas: sql<number>`sum(${cttu_crashes.vitimas})`,
        vitimasFat: sql<number>`sum(${cttu_crashes.vitimas_fat})`,
      })
      .from(cttu_crashes)
      .execute();
    const totalVitimas = Number(vitRes[0].vitimas);
    const totalVitimasFatais = Number(vitRes[0].vitimasFat);

    // Estatísticas por ano
    const yearData = await db
      .select({
        year: sql<number>`date_part('year', ${cttu_crashes.data})`,
        count: sql<number>`count(*)`,
      })
      .from(cttu_crashes)
      .where(sql`date_part('year', ${cttu_crashes.data}) >= 2016`)
      .groupBy(sql`date_part('year', ${cttu_crashes.data})`)
      .execute();

    const years = yearData.length;
    const sumYears = yearData.reduce((sum, y) => sum + Number(y.count), 0);
    const mediaAnual = years > 0 ? sumYears / years : 0;

    // Crescimento no último ano vs anterior
    const sorted = [...yearData].sort(
      (a, b) => Number(a.year) - Number(b.year)
    );
    const last = sorted[sorted.length - 1] || { count: 0 };
    const prev = sorted[sorted.length - 2] || { count: 0 };
    const crescimentoAno = prev.count
      ? ((Number(last.count) - Number(prev.count)) / Number(prev.count)) * 100
      : 0;

    return c.json({
      totalSinistros,
      totalVitimas,
      totalVitimasFatais,
      mediaAnual,
      crescimentoAno,
    });
  } catch (err) {
    console.error(err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default app;
