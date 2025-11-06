import { sql, inArray } from "drizzle-orm";
import { samu_calls } from "../../db/schema";
import { config } from "./config";

export function getOutcomeFilter(includeInvalid: boolean = false) {
  if (includeInvalid) {
    return sql`1=1`; // Retorna todos os registros
  }
  
  // Retorna apenas desfechos válidos
  return inArray(samu_calls.motivo_desf_cat, config.desfechos.validos);
}

export function parseIncludeInvalid(query: Record<string, string> | any): boolean {
  const includeInvalid = query.incluir_invalidos || query.include_invalid;
  return includeInvalid === 'true' || includeInvalid === '1';
}

export function calcularProjecaoAnual(dadosAno: { ano: number; count: number; ultimaData: string }[]): { ano: number; count: number; projecao?: number }[] {
  return dadosAno.map(item => {
    const ultimaData = new Date(item.ultimaData);
    const anoAtual = item.ano;
    const ultimoDiaDoAno = new Date(anoAtual, 11, 31); // 31 de dezembro
    
    // Se a última data não é 31/12, calcular projeção
    if (ultimaData.getTime() < ultimoDiaDoAno.getTime()) {
      const diasDecorridos = Math.floor((ultimaData.getTime() - new Date(anoAtual, 0, 1).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const diasTotaisAno = Math.floor((ultimoDiaDoAno.getTime() - new Date(anoAtual, 0, 1).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      const projecao = Math.round((item.count / diasDecorridos) * diasTotaisAno);
      
      return {
        ...item,
        projecao
      };
    }
    
    return item;
  });
}