// modules/samu-calls/filtros.ts
import express, { Request, Response } from "express";
import { db } from "../../db";
import { samu_calls } from "../../db/modules/casualties/table_samu_calls";
import { cities } from "../../db/modules/global/table_cities";
import { sql } from "drizzle-orm";
import { config } from "./config";

const router = express.Router();

interface FiltroParams {
  cityId?: number;
  startYear?: number;
  endYear?: number;
  gender?: string[];
  ageMin?: number;
  ageMax?: number;
  category?: string[];
  subtype?: string[];
  startHour?: number;
  endHour?: number;
  finalizationReason?: string[];
  outcomeReason?: string[];
  includeInvalid?: boolean;
  
  // Campos antigos para compatibilidade
  municipio?: number;
  anoInicio?: number;
  anoFim?: number;
  sexo?: string[];
  idadeMin?: number;
  idadeMax?: number;
  categoria?: string[];
  subtipo?: string[];
  horaInicio?: number;
  horaFim?: number;
  motivoFinalizacao?: string[];
  motivoDesfecho?: string[];
  incluirInvalidos?: boolean;
}

router.get("/", async (req: Request, res: Response) => {
  try {
    // Extrair parâmetros de filtro da requisição
    const filtros: FiltroParams = {};
    
    // Município específico ou todos da RMR (cityId ou municipio)
    if (req.query.cityId && !isNaN(Number(req.query.cityId))) {
      filtros.cityId = Number(req.query.cityId);
    } else if (req.query.municipio && !isNaN(Number(req.query.municipio))) {
      filtros.cityId = Number(req.query.municipio);
    }
    
    // Anos (startYear/endYear ou anoInicio/anoFim)
    if (req.query.startYear && !isNaN(Number(req.query.startYear))) {
      filtros.startYear = Number(req.query.startYear);
    } else if (req.query.anoInicio && !isNaN(Number(req.query.anoInicio))) {
      filtros.startYear = Number(req.query.anoInicio);
    } else {
      // Padrão: últimos 10 anos
      filtros.startYear = new Date().getFullYear() - config.periodos.anosRetroativos;
    }
    
    if (req.query.endYear && !isNaN(Number(req.query.endYear))) {
      filtros.endYear = Number(req.query.endYear);
    } else if (req.query.anoFim && !isNaN(Number(req.query.anoFim))) {
      filtros.endYear = Number(req.query.anoFim);
    }
    
    // Sexo (gender ou sexo)
    if (req.query.gender) {
      filtros.gender = Array.isArray(req.query.gender) 
        ? req.query.gender as string[] 
        : [req.query.gender as string];
    } else if (req.query.sexo) {
      filtros.gender = Array.isArray(req.query.sexo) 
        ? req.query.sexo as string[] 
        : [req.query.sexo as string];
    }
    
    // Faixa etária (ageMin/ageMax ou idadeMin/idadeMax)
    if (req.query.ageMin && !isNaN(Number(req.query.ageMin))) {
      filtros.ageMin = Number(req.query.ageMin);
    } else if (req.query.idadeMin && !isNaN(Number(req.query.idadeMin))) {
      filtros.ageMin = Number(req.query.idadeMin);
    }
    
    if (req.query.ageMax && !isNaN(Number(req.query.ageMax))) {
      filtros.ageMax = Number(req.query.ageMax);
    } else if (req.query.idadeMax && !isNaN(Number(req.query.idadeMax))) {
      filtros.ageMax = Number(req.query.idadeMax);
    }
    
    // Categoria (category ou categoria)
    if (req.query.category) {
      filtros.category = Array.isArray(req.query.category) 
        ? req.query.category as string[] 
        : [req.query.category as string];
    } else if (req.query.categoria) {
      filtros.category = Array.isArray(req.query.categoria) 
        ? req.query.categoria as string[] 
        : [req.query.categoria as string];
    }
    
    // Subtipo (subtype ou subtipo)
    if (req.query.subtype) {
      filtros.subtype = Array.isArray(req.query.subtype) 
        ? req.query.subtype as string[] 
        : [req.query.subtype as string];
    } else if (req.query.subtipo) {
      filtros.subtype = Array.isArray(req.query.subtipo) 
        ? req.query.subtipo as string[] 
        : [req.query.subtipo as string];
    }
    
    // Horário (startHour/endHour ou horaInicio/horaFim)
    if (req.query.startHour && !isNaN(Number(req.query.startHour))) {
      filtros.startHour = Number(req.query.startHour);
    } else if (req.query.horaInicio && !isNaN(Number(req.query.horaInicio))) {
      filtros.startHour = Number(req.query.horaInicio);
    }
    
    if (req.query.endHour && !isNaN(Number(req.query.endHour))) {
      filtros.endHour = Number(req.query.endHour);
    } else if (req.query.horaFim && !isNaN(Number(req.query.horaFim))) {
      filtros.endHour = Number(req.query.horaFim);
    }
    
    // Motivo de finalização (finalizationReason ou motivoFinalizacao)
    if (req.query.finalizationReason) {
      filtros.finalizationReason = Array.isArray(req.query.finalizationReason) 
        ? req.query.finalizationReason as string[] 
        : [req.query.finalizationReason as string];
    } else if (req.query.motivoFinalizacao) {
      filtros.finalizationReason = Array.isArray(req.query.motivoFinalizacao) 
        ? req.query.motivoFinalizacao as string[] 
        : [req.query.motivoFinalizacao as string];
    }
    
    // Motivo de desfecho (outcomeReason ou motivoDesfecho)
    if (req.query.outcomeReason) {
      filtros.outcomeReason = Array.isArray(req.query.outcomeReason) 
        ? req.query.outcomeReason as string[] 
        : [req.query.outcomeReason as string];
    } else if (req.query.motivoDesfecho) {
      filtros.outcomeReason = Array.isArray(req.query.motivoDesfecho) 
        ? req.query.motivoDesfecho as string[] 
        : [req.query.motivoDesfecho as string];
    }
    
    // Incluir inválidos (includeInvalid ou incluirInvalidos)
    if (req.query.includeInvalid !== undefined) {
      filtros.includeInvalid = req.query.includeInvalid === 'true';
    } else if (req.query.incluirInvalidos !== undefined) {
      filtros.includeInvalid = req.query.incluirInvalidos === 'true';
    } else {
      filtros.includeInvalid = false; // Padrão: não incluir inválidos
    }
    
    // Construir a consulta SQL com base nos filtros
    let whereClause = sql`true`;
    
    // Filtro de município
    if (filtros.cityId) {
      whereClause = sql`${whereClause} AND ${samu_calls.city_id} = ${filtros.cityId}`;
    } else {
      // Se não especificou município, filtra por todos da RMR
      const rmrCities = await db
        .select({ id: cities.id })
        .from(cities)
        .where(sql`${cities.rmr} = true`)
        .execute();
      
      if (rmrCities.length === 0) {
        return res.status(404).json({ error: "No RMR cities found" });
      }
      
      let cityClause = sql`false`;
      for (const city of rmrCities) {
        cityClause = sql`${cityClause} OR ${samu_calls.city_id} = ${city.id}`;
      }
      whereClause = sql`${whereClause} AND (${cityClause})`;
    }
    
    // Filtro de ano
    whereClause = sql`${whereClause} AND EXTRACT(YEAR FROM ${samu_calls.data}) >= ${filtros.startYear}`;
    if (filtros.endYear) {
      whereClause = sql`${whereClause} AND EXTRACT(YEAR FROM ${samu_calls.data}) <= ${filtros.endYear}`;
    }
    
    // Filtro de sexo
    if (filtros.gender && filtros.gender.length > 0) {
      let sexoClause = sql`false`;
      for (const sexo of filtros.gender) {
        sexoClause = sql`${sexoClause} OR ${samu_calls.sexo} = ${sexo}`;
      }
      whereClause = sql`${whereClause} AND (${sexoClause})`;
    }
    
    // Filtro de faixa etária
    if (filtros.ageMin !== undefined) {
      whereClause = sql`${whereClause} AND ${samu_calls.idade} >= ${filtros.ageMin}`;
    }
    
    if (filtros.ageMax !== undefined) {
      whereClause = sql`${whereClause} AND ${samu_calls.idade} <= ${filtros.ageMax}`;
    }
    
    // Filtro de categoria
    if (filtros.category && filtros.category.length > 0) {
      let categoriaClause = sql`false`;
      for (const categoria of filtros.category) {
        categoriaClause = sql`${categoriaClause} OR ${samu_calls.categoria} = ${categoria}`;
      }
      whereClause = sql`${whereClause} AND (${categoriaClause})`;
    }
    
    // Filtro de subtipo
    if (filtros.subtype && filtros.subtype.length > 0) {
      let subtipoClause = sql`false`;
      for (const subtipo of filtros.subtype) {
        subtipoClause = sql`${subtipoClause} OR ${samu_calls.subtipo} = ${subtipo}`;
      }
      whereClause = sql`${whereClause} AND (${subtipoClause})`;
    }
    
    // Filtro de horário
    if (filtros.startHour !== undefined) {
      whereClause = sql`${whereClause} AND EXTRACT(HOUR FROM ${samu_calls.hora_minuto}) >= ${filtros.startHour}`;
    }
    
    if (filtros.endHour !== undefined) {
      whereClause = sql`${whereClause} AND EXTRACT(HOUR FROM ${samu_calls.hora_minuto}) <= ${filtros.endHour}`;
    }
    
    // Filtro de motivo de finalização
    if (filtros.finalizationReason && filtros.finalizationReason.length > 0) {
      let motivoFinClause = sql`false`;
      for (const motivo of filtros.finalizationReason) {
        motivoFinClause = sql`${motivoFinClause} OR ${samu_calls.motivo_fin_cat} = ${motivo}`;
      }
      whereClause = sql`${whereClause} AND (${motivoFinClause})`;
    }
    
    // Filtro de motivo de desfecho
    if (filtros.outcomeReason && filtros.outcomeReason.length > 0) {
      let motivoDesfClause = sql`false`;
      for (const motivo of filtros.outcomeReason) {
        motivoDesfClause = sql`${motivoDesfClause} OR ${samu_calls.motivo_desf_cat} = ${motivo}`;
      }
      whereClause = sql`${whereClause} AND (${motivoDesfClause})`;
    }
    
    // Filtro de desfechos válidos/inválidos
    if (!filtros.includeInvalid) {
      let validOutcomesClause = sql`false`;
      for (const outcome of config.desfechos.validos) {
        validOutcomesClause = sql`${validOutcomesClause} OR ${samu_calls.motivo_fin_cat} = ${outcome}`;
      }
      whereClause = sql`${whereClause} AND (${validOutcomesClause})`;
    }
    
    // Consulta principal
    const result = await db
      .select({
        total: sql<number>`count(*)`,
        ano: sql<number>`EXTRACT(YEAR FROM ${samu_calls.data})`,
        mes: sql<number>`EXTRACT(MONTH FROM ${samu_calls.data})`,
        hora: sql<number>`EXTRACT(HOUR FROM ${samu_calls.hora_minuto})`,
        sexo: samu_calls.sexo,
        idade: samu_calls.idade,
        municipio: cities.name,
        categoria: samu_calls.categoria,
        subtipo: samu_calls.subtipo,
        motivoFinalizacao: samu_calls.motivo_fin_cat,
        motivoDesfecho: samu_calls.motivo_desf_cat
      })
      .from(samu_calls)
      .leftJoin(cities, sql`${samu_calls.city_id} = ${cities.id}`)
      .where(whereClause)
      .groupBy(
        sql`EXTRACT(YEAR FROM ${samu_calls.data})`,
        sql`EXTRACT(MONTH FROM ${samu_calls.data})`,
        sql`EXTRACT(HOUR FROM ${samu_calls.hora_minuto})`,
        samu_calls.sexo,
        samu_calls.idade,
        cities.name,
        samu_calls.categoria,
        samu_calls.subtipo,
        samu_calls.motivo_fin_cat,
        samu_calls.motivo_desf_cat
      )
      .orderBy(sql`EXTRACT(YEAR FROM ${samu_calls.data})`, sql`EXTRACT(MONTH FROM ${samu_calls.data})`)
      .execute();
    
    // Processar resultados para formato mais amigável
    const processedResults = result.map(row => {
      // Determinar faixa etária
      const faixaEtaria = config.mapeamentos.faixasEtarias.find(
        faixa => row.idade !== null && row.idade >= faixa.min && row.idade <= faixa.max
      )?.label || 'Não informado';
      
      return {
        ano: Number(row.ano),
        mes: Number(row.mes),
        hora: Number(row.hora),
        municipio: {
          nome: row.municipio || 'Não informado'
        },
        sexo: {
          codigo: row.sexo,
          descricao: row.sexo ? config.mapeamentos.sexo[row.sexo as keyof typeof config.mapeamentos.sexo] || 'Não informado' : 'Não informado'
        },
        idade: row.idade,
        faixaEtaria,
        categoria: {
          codigo: row.categoria,
          descricao: row.categoria ? config.mapeamentos.categoria[row.categoria as keyof typeof config.mapeamentos.categoria] || row.categoria : 'Não informado'
        },
        subtipo: {
          codigo: row.subtipo,
          descricao: row.subtipo ? config.mapeamentos.subtipo[row.subtipo as keyof typeof config.mapeamentos.subtipo] || row.subtipo : 'Não informado'
        },
        motivoFinalizacao: {
          codigo: row.motivoFinalizacao,
          descricao: row.motivoFinalizacao ? config.mapeamentos.motivoFinalizacao[row.motivoFinalizacao as keyof typeof config.mapeamentos.motivoFinalizacao] || row.motivoFinalizacao : 'Não informado'
        },
        motivoDesfecho: {
          codigo: row.motivoDesfecho,
          descricao: row.motivoDesfecho ? config.mapeamentos.motivoDesfecho[row.motivoDesfecho as keyof typeof config.mapeamentos.motivoDesfecho] || row.motivoDesfecho : 'Não informado'
        },
        total: Number(row.total)
      };
    });
    
    // Calcular totais
    const totalGeral = processedResults.reduce((sum, item) => sum + item.total, 0);
    
    // Agrupar por ano
    const porAno = processedResults.reduce((acc, item) => {
      const ano = item.ano;
      if (!acc[ano]) {
        acc[ano] = 0;
      }
      acc[ano] += item.total;
      return acc;
    }, {} as Record<number, number>);
    
    // Agrupar por sexo
    const porSexo = processedResults.reduce((acc, item) => {
      const sexo = item.sexo.descricao;
      if (!acc[sexo]) {
        acc[sexo] = 0;
      }
      acc[sexo] += item.total;
      return acc;
    }, {} as Record<string, number>);
    
    // Agrupar por faixa etária
    const porFaixaEtaria = processedResults.reduce((acc, item) => {
      const faixaEtaria = item.faixaEtaria;
      if (!acc[faixaEtaria]) {
        acc[faixaEtaria] = 0;
      }
      acc[faixaEtaria] += item.total;
      return acc;
    }, {} as Record<string, number>);
    
    // Agrupar por município
    const porMunicipio = processedResults.reduce((acc, item) => {
      const municipio = item.municipio.nome;
      if (!acc[municipio]) {
        acc[municipio] = 0;
      }
      acc[municipio] += item.total;
      return acc;
    }, {} as Record<string, number>);
    
    // Agrupar por categoria
    const porCategoria = processedResults.reduce((acc, item) => {
      const categoria = item.categoria.descricao;
      if (!acc[categoria]) {
        acc[categoria] = 0;
      }
      acc[categoria] += item.total;
      return acc;
    }, {} as Record<string, number>);
    
    // Agrupar por subtipo
    const porSubtipo = processedResults.reduce((acc, item) => {
      const subtipo = item.subtipo.descricao;
      if (!acc[subtipo]) {
        acc[subtipo] = 0;
      }
      acc[subtipo] += item.total;
      return acc;
    }, {} as Record<string, number>);
    
    // Agrupar por hora
    const porHora = processedResults.reduce((acc, item) => {
      const hora = item.hora;
      if (!acc[hora]) {
        acc[hora] = 0;
      }
      acc[hora] += item.total;
      return acc;
    }, {} as Record<number, number>);
    
    // Resposta final
    res.json({
      filtrosAplicados: filtros,
      totalGeral,
      resumo: {
        porAno,
        porSexo,
        porFaixaEtaria,
        porMunicipio,
        porCategoria,
        porSubtipo,
        porHora
      },
      dados: processedResults
    });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;