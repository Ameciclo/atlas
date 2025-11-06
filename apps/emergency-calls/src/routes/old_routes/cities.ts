import { Hono } from "hono";
import { db } from "../../db";
import { samu_calls, cities } from "../../db/schema";
import { sql, eq, and, inArray } from "drizzle-orm";
import { getOutcomeFilter, parseIncludeInvalid, calcularProjecaoAnual } from "./utils";
import { config } from "./config";

const app = new Hono();

// Listar cidades disponíveis nos dados do SAMU
app.get("/", async (c) => {
  try {
    const includeInvalid = parseIncludeInvalid(c.req.query());
    const filter = c.req.query('filter') || 'validos';
    
    let whereCondition;
    if (filter === 'invalidos') {
      whereCondition = getOutcomeFilter(true);
    } else if (filter === 'totais') {
      whereCondition = sql`1=1`;
    } else {
      whereCondition = getOutcomeFilter(false);
    }

    const citiesWithData = await db
      .select({
        municipio_samu: samu_calls.municipio,
        count: sql<number>`count(*)::int`,
        id: cities.id,
        name: cities.name,
        rmr: cities.rmr
      })
      .from(samu_calls)
      .leftJoin(cities, eq(samu_calls.city_id, cities.id))
      .where(and(whereCondition, sql`${cities.name} IS NOT NULL`))
      .groupBy(samu_calls.municipio, cities.id, cities.name, cities.rmr)
      .orderBy(sql`count(*) desc`);

    // Processar cidades em lotes menores para evitar timeout
    const citiesWithHistory = [];
    const batchSize = 10; // Processar 10 cidades por vez
    
    for (let i = 0; i < citiesWithData.length; i += batchSize) {
      const batch = citiesWithData.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (city, batchIndex) => {
          const index = i + batchIndex;
        const yearlyHistory = await db
          .select({
            ano: sql<number>`EXTRACT(YEAR FROM ${samu_calls.data})::int`,
            total_chamados: sql<number>`count(*)::int`,
            ultimaData: sql<string>`to_char(max(${samu_calls.data}), 'YYYY-MM-DD')`,
            validos: {
              total: sql<number>`count(case when ${samu_calls.motivo_desf_cat} in ('Atendimento Concluído com Êxito', 'Removido por Particulares', 'Removido pelos Bombeiros/CIODS', 'Óbito no Local/Atendimento') then 1 end)::int`,
              atendimento_concluido: sql<number>`count(case when ${samu_calls.motivo_desf_cat} = 'Atendimento Concluído com Êxito' then 1 end)::int`,
              removido_particulares: sql<number>`count(case when ${samu_calls.motivo_desf_cat} = 'Removido por Particulares' then 1 end)::int`,
              removido_bombeiros: sql<number>`count(case when ${samu_calls.motivo_desf_cat} = 'Removido pelos Bombeiros/CIODS' then 1 end)::int`,
              obito_local: sql<number>`count(case when ${samu_calls.motivo_desf_cat} = 'Óbito no Local/Atendimento' then 1 end)::int`
            },
            invalidos: sql<number>`count(case when ${samu_calls.motivo_desf_cat} in ('Sem Desfecho/Casa Fechada/Não há paciente', 'Desistência da solicitação', 'Recusa de Remoção', 'Inválido/Duplicado/Cancelado/Trote', 'Não necessita/Sem Condições Clínicas', 'Outros Desfechos') then 1 end)::int`,
            por_sexo: {
              masculino: sql<number>`count(case when ${samu_calls.sexo} = 'Masculino' then 1 end)::int`,
              feminino: sql<number>`count(case when ${samu_calls.sexo} = 'Feminino' then 1 end)::int`,
              nao_informado: sql<number>`count(case when ${samu_calls.sexo} IS NULL OR ${samu_calls.sexo} = '' then 1 end)::int`
            },
            por_faixa_etaria: {
              "0_17_anos": sql<number>`count(case when ${samu_calls.idade} BETWEEN 0 AND 17 then 1 end)::int`,
              "18_29_anos": sql<number>`count(case when ${samu_calls.idade} BETWEEN 18 AND 29 then 1 end)::int`,
              "30_49_anos": sql<number>`count(case when ${samu_calls.idade} BETWEEN 30 AND 49 then 1 end)::int`,
              "50_64_anos": sql<number>`count(case when ${samu_calls.idade} BETWEEN 50 AND 64 then 1 end)::int`,
              "65_mais_anos": sql<number>`count(case when ${samu_calls.idade} >= 65 then 1 end)::int`,
              nao_informado: sql<number>`count(case when ${samu_calls.idade} IS NULL then 1 end)::int`
            },
            por_categoria: {
              sinistro_moto: sql<number>`count(case when ${samu_calls.categoria} = 'Acidente de Moto' then 1 end)::int`,
              sinistro_carro: sql<number>`count(case when ${samu_calls.categoria} = 'Acidente de Carro' then 1 end)::int`,
              atropelamento_carro: sql<number>`count(case when ${samu_calls.categoria} = 'Atropelamento por Carro' then 1 end)::int`,
              atropelamento_moto: sql<number>`count(case when ${samu_calls.categoria} = 'Atropelamento por Moto' then 1 end)::int`,
              sinistro_bicicleta: sql<number>`count(case when ${samu_calls.categoria} = 'Acidente de Bicicleta' then 1 end)::int`,
              sinistro_onibus_caminhao: sql<number>`count(case when ${samu_calls.categoria} = 'Acidente Ônibus/Caminhão' then 1 end)::int`,
              atropelamento_onibus_caminhao: sql<number>`count(case when ${samu_calls.categoria} = 'Atropelamento Ônibus/Caminhão' then 1 end)::int`,
              atropelamento_bicicleta: sql<number>`count(case when ${samu_calls.categoria} = 'Atropelamento por Bicicleta' then 1 end)::int`,
              outro: sql<number>`count(case when ${samu_calls.categoria} = 'Outro' then 1 end)::int`,
              nao_informado: sql<number>`count(case when ${samu_calls.categoria} IS NULL then 1 end)::int`
            }
          })
          .from(samu_calls)
          .where(and(
            sql`LOWER(${samu_calls.municipio}) = LOWER(${city.municipio_samu})`,
            whereCondition
          ))
          .groupBy(sql`EXTRACT(YEAR FROM ${samu_calls.data})`)
          .orderBy(sql`EXTRACT(YEAR FROM ${samu_calls.data})`);

        // Calcular projeções para o histórico anual
        const historicoComProjecao = calcularProjecaoAnual(yearlyHistory.map(item => ({
          ano: Number(item.ano),
          count: Number(item.total_chamados),
          ultimaData: item.ultimaData
        })));

          return {
            ...city,
            ranking: index + 1,
            historico_anual: yearlyHistory.map((item, idx) => ({
              ...item,
              projecao_total_chamados: historicoComProjecao[idx]?.projecao
            }))
          };
        })
      );
      citiesWithHistory.push(...batchResults);
    }

    // Período dos dados gerais
    const periodo = await db
      .select({
        inicio: sql<number>`extract(year from min(${samu_calls.data}))`,
        fim: sql<number>`extract(year from max(${samu_calls.data}))`,
        ultimoMes: sql<string>`to_char(max(${samu_calls.data}), 'YYYY.MM')`,
        ultimoDia: sql<string>`to_char(max(${samu_calls.data}), 'YYYY-MM-DD')`
      })
      .from(samu_calls)
      .where(and(sql`${samu_calls.data} IS NOT NULL`, whereCondition));

    // Total de dias únicos com dados
    const diasComDados = await db
      .select({
        totalDias: sql<number>`COUNT(DISTINCT ${samu_calls.data})`
      })
      .from(samu_calls)
      .where(and(sql`${samu_calls.data} IS NOT NULL`, whereCondition));

    return c.json({
      cidades: citiesWithHistory,
      total: citiesWithHistory.length,
      recife_id: 2611606,
      filtro_aplicado: filter,
      periodo: {
        inicio: Number(periodo[0]?.inicio),
        fim: Number(periodo[0]?.fim),
        ultimoMes: periodo[0]?.ultimoMes,
        ultimoDia: periodo[0]?.ultimoDia,
        totalDiasComDados: Number(diasComDados[0]?.totalDias || 0)
      }
    });
  } catch (error: any) {
    console.error("GET /samu-calls/cities failed:", error);
    return c.json({ error: "Internal Server Error", detail: error.message }, 500);
  }
});

export default app;