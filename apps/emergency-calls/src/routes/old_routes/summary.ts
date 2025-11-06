import { Hono } from "hono";
import { db } from "../../db";
import { samu_calls, cities } from "../../db/schema";
import { sql, eq, and, gte, lte, inArray } from "drizzle-orm";
import { getOutcomeFilter, parseIncludeInvalid, calcularProjecaoAnual } from "./utils";
import { config } from "./config";

const app = new Hono();

app.get("/", async (c) => {
  try {
    const includeInvalid = parseIncludeInvalid(c.req.query());
    const outcomeFilter = getOutcomeFilter(includeInvalid);

    // Total de chamadas
    const totalCalls = await db
      .select({ count: sql<number>`count(*)` })
      .from(samu_calls)
      .where(outcomeFilter);

    // Total de chamadas com desfechos válidos
    const totalValidOutcomes = await db
      .select({ count: sql<number>`count(*)` })
      .from(samu_calls)
      .where(and(
        inArray(samu_calls.motivo_desf_cat, config.desfechos.validos),
        outcomeFilter
      ));

    // Total de chamadas com desfechos inválidos
    const totalInvalidOutcomes = await db
      .select({ count: sql<number>`count(*)` })
      .from(samu_calls)
      .where(and(
        inArray(samu_calls.motivo_desf_cat, config.desfechos.invalidos),
        outcomeFilter
      ));

    // Cidade mais violenta (com mais chamadas válidas)
    const mostViolentCityData = await db
      .select({
        municipio: samu_calls.municipio,
        totalValidas: sql<number>`count(case when ${samu_calls.motivo_desf_cat} in (${sql.join(config.desfechos.validos.map(d => sql`${d}`), sql`, `)}) then 1 end)`,
        totalInvalidas: sql<number>`count(case when ${samu_calls.motivo_desf_cat} in (${sql.join(config.desfechos.invalidos.map(d => sql`${d}`), sql`, `)}) then 1 end)`,
        total: sql<number>`count(*)`
      })
      .from(samu_calls)
      .where(and(sql`${samu_calls.municipio} IS NOT NULL`, outcomeFilter))
      .groupBy(samu_calls.municipio)
      .orderBy(sql`count(case when ${samu_calls.motivo_desf_cat} in (${sql.join(config.desfechos.validos.map(d => sql`${d}`), sql`, `)}) then 1 end) desc`)
      .limit(1);

    // Evolução anual da cidade mais violenta
    let mostViolentCityEvolution: Array<{
      ano: number;
      totalValidas: number;
      totalInvalidas: number;
      total: number;
    }> = [];
    
    if (mostViolentCityData.length > 0) {
      const cityName = mostViolentCityData[0].municipio;
      if (cityName) {
        mostViolentCityEvolution = await db
          .select({
            ano: sql<number>`EXTRACT(YEAR FROM ${samu_calls.data})`,
            totalValidas: sql<number>`count(case when ${samu_calls.motivo_desf_cat} in (${sql.join(config.desfechos.validos.map(d => sql`${d}`), sql`, `)}) then 1 end)`,
            totalInvalidas: sql<number>`count(case when ${samu_calls.motivo_desf_cat} in (${sql.join(config.desfechos.invalidos.map(d => sql`${d}`), sql`, `)}) then 1 end)`,
            total: sql<number>`count(*)`
          })
          .from(samu_calls)
          .where(and(
            eq(samu_calls.municipio, cityName),
            sql`${samu_calls.data} IS NOT NULL`,
            outcomeFilter
          ))
          .groupBy(sql`EXTRACT(YEAR FROM ${samu_calls.data})`)
          .orderBy(sql`EXTRACT(YEAR FROM ${samu_calls.data})`);
      }
    }

    // Chamadas por categoria
    const byCategory = await db
      .select({
        categoria: samu_calls.categoria,
        count: sql<number>`count(*)`
      })
      .from(samu_calls)
      .where(and(sql`${samu_calls.categoria} IS NOT NULL`, outcomeFilter))
      .groupBy(samu_calls.categoria)
      .orderBy(sql`count(*) desc`);

    // Chamadas por motivo de finalização
    const byFinalizacao = await db
      .select({
        motivo_fin_cat: samu_calls.motivo_fin_cat,
        count: sql<number>`count(*)`
      })
      .from(samu_calls)
      .where(and(sql`${samu_calls.motivo_fin_cat} IS NOT NULL`, outcomeFilter))
      .groupBy(samu_calls.motivo_fin_cat)
      .orderBy(sql`count(*) desc`);

    // Chamadas por motivo de desfecho
    const byDesfecho = await db
      .select({
        motivo_desf_cat: samu_calls.motivo_desf_cat,
        count: sql<number>`count(*)`
      })
      .from(samu_calls)
      .where(and(sql`${samu_calls.motivo_desf_cat} IS NOT NULL`, outcomeFilter))
      .groupBy(samu_calls.motivo_desf_cat)
      .orderBy(sql`count(*) desc`);

    // Chamadas por ano com última data
    const byYear = await db
      .select({
        ano: sql<number>`EXTRACT(YEAR FROM ${samu_calls.data})`,
        count: sql<number>`count(*)`,
        ultimaData: sql<string>`to_char(max(${samu_calls.data}), 'YYYY-MM-DD')`
      })
      .from(samu_calls)
      .where(and(sql`${samu_calls.data} IS NOT NULL`, outcomeFilter))
      .groupBy(sql`EXTRACT(YEAR FROM ${samu_calls.data})`)
      .orderBy(sql`EXTRACT(YEAR FROM ${samu_calls.data})`);

    // Calcular projeções
    const dadosComProjecao = calcularProjecaoAnual(byYear.map(item => ({
      ano: Number(item.ano),
      count: Number(item.count),
      ultimaData: item.ultimaData
    })));

    // Período dos dados
    const periodo = await db
      .select({
        inicio: sql<number>`extract(year from min(${samu_calls.data}))`,
        fim: sql<number>`extract(year from max(${samu_calls.data}))`,
        ultimoMes: sql<string>`to_char(max(${samu_calls.data}), 'YYYY.MM')`,
        ultimoDia: sql<string>`to_char(max(${samu_calls.data}), 'YYYY-MM-DD')`
      })
      .from(samu_calls)
      .where(and(sql`${samu_calls.data} IS NOT NULL`, outcomeFilter));

    // Total de dias únicos com dados
    const diasComDados = await db
      .select({
        totalDias: sql<number>`COUNT(DISTINCT ${samu_calls.data})`
      })
      .from(samu_calls)
      .where(and(sql`${samu_calls.data} IS NOT NULL`, outcomeFilter));

    return c.json({
      totalChamadas: Number(totalCalls[0].count),
      totalDesfechosValidos: Number(totalValidOutcomes[0].count),
      totalDesfechosInvalidos: Number(totalInvalidOutcomes[0].count),
      cidadeMaisViolenta: mostViolentCityData.length > 0 ? {
        municipio: mostViolentCityData[0].municipio,
        totalValidas: Number(mostViolentCityData[0].totalValidas),
        totalInvalidas: Number(mostViolentCityData[0].totalInvalidas),
        total: Number(mostViolentCityData[0].total),
        evolucaoAnual: mostViolentCityEvolution.map(item => ({
          ano: Number(item.ano),
          totalValidas: Number(item.totalValidas),
          totalInvalidas: Number(item.totalInvalidas),
          total: Number(item.total)
        }))
      } : null,
      porCategoria: byCategory.map(item => ({
        categoria: item.categoria,
        count: Number(item.count)
      })),
      porMotivoFinalizacao: byFinalizacao.map(item => ({
        motivo_fin_cat: item.motivo_fin_cat,
        count: Number(item.count)
      })),
      porMotivoDesfecho: byDesfecho.map(item => ({
        motivo_desf_cat: item.motivo_desf_cat,
        count: Number(item.count)
      })),
      evolucaoAnual: dadosComProjecao,
      periodo: {
        inicio: Number(periodo[0]?.inicio),
        fim: Number(periodo[0]?.fim),
        ultimoMes: periodo[0]?.ultimoMes,
        ultimoDia: periodo[0]?.ultimoDia,
        totalDiasComDados: Number(diasComDados[0]?.totalDias || 0)
      },
      filtros: {
        incluir_invalidos: includeInvalid
      }
    });
  } catch (error: any) {
    console.error("GET /samu-calls/summary failed:", error);
    return c.json({ error: "Internal Server Error", detail: error.message }, 500);
  }
});

export default app;