-- ============================================================================
-- QUERIES DE VALIDAÇÃO - TRAFFIC VIOLATIONS
-- ============================================================================
-- Propósito: Testar e validar os dados inseridos na base
-- Como executar: Via Drizzle Studio ou cliente PostgreSQL

-- ============================================================================
-- 1. CONTAGEM TOTAL DE REGISTROS
-- ============================================================================
SELECT COUNT(*) as total_violations FROM traffic_violations;

-- ============================================================================
-- 2. DISTRIBUIÇÃO POR PERÍODO
-- ============================================================================

-- Por ano
SELECT 
  EXTRACT(YEAR FROM violation_date) as year,
  COUNT(*) as violations_count
FROM traffic_violations 
GROUP BY EXTRACT(YEAR FROM violation_date) 
ORDER BY year;

-- Por mês (últimos 12 meses)
SELECT 
  TO_CHAR(violation_date, 'YYYY-MM') as month,
  COUNT(*) as violations_count
FROM traffic_violations 
WHERE violation_date >= NOW() - INTERVAL '12 months'
GROUP BY TO_CHAR(violation_date, 'YYYY-MM') 
ORDER BY month;

-- ============================================================================
-- 3. ANÁLISE DE TIPOS DE VIOLAÇÃO
-- ============================================================================

-- Top 10 violações mais frequentes por código CTTU
SELECT 
  cttu_code,
  COUNT(*) as frequency
FROM traffic_violations 
GROUP BY cttu_code 
ORDER BY frequency DESC 
LIMIT 10;

-- Distribuição por código de lei
SELECT 
  law_code,
  COUNT(*) as violations_count
FROM traffic_violations 
GROUP BY law_code 
ORDER BY violations_count DESC;

-- ============================================================================
-- 4. ANÁLISE DE AGENTES
-- ============================================================================

-- Top 10 agentes com mais autuações
SELECT 
  agent_id,
  COUNT(*) as violations_issued
FROM traffic_violations 
GROUP BY agent_id 
ORDER BY violations_issued DESC 
LIMIT 10;

-- Distribuição de autuações por agente
SELECT 
  violations_per_agent,
  COUNT(*) as agents_count
FROM (
  SELECT agent_id, COUNT(*) as violations_per_agent
  FROM traffic_violations 
  GROUP BY agent_id
) agent_stats
GROUP BY violations_per_agent 
ORDER BY violations_per_agent;

-- ============================================================================
-- 5. ANÁLISE DE LOCALIZAÇÃO
-- ============================================================================

-- Top 10 locais com mais violações
SELECT 
  location_id,
  location_description,
  COUNT(*) as violations_count
FROM traffic_violations 
GROUP BY location_id, location_description 
ORDER BY violations_count DESC 
LIMIT 10;

-- ============================================================================
-- 6. VALIDAÇÃO DE COORDENADAS
-- ============================================================================

-- Registros com coordenadas válidas
SELECT COUNT(*) as with_coordinates 
FROM traffic_violations 
WHERE coordinates IS NOT NULL AND coordinates != '';

-- Registros sem coordenadas
SELECT COUNT(*) as without_coordinates 
FROM traffic_violations 
WHERE coordinates IS NULL OR coordinates = '';

-- Amostra de coordenadas (primeiros 5)
SELECT id, coordinates, location_description
FROM traffic_violations 
WHERE coordinates IS NOT NULL 
LIMIT 5;

-- ============================================================================
-- 7. ANÁLISE DE DADOS COMPLEMENTARES (JSONB)
-- ============================================================================

-- Registros com dados complementares
SELECT COUNT(*) as with_complementary_data 
FROM traffic_violations 
WHERE complementary_data IS NOT NULL;

-- Chaves mais comuns nos dados complementares
SELECT 
  jsonb_object_keys(complementary_data) as key,
  COUNT(*) as frequency
FROM traffic_violations 
WHERE complementary_data IS NOT NULL
GROUP BY jsonb_object_keys(complementary_data) 
ORDER BY frequency DESC;

-- Amostra de dados complementares
SELECT id, complementary_data
FROM traffic_violations 
WHERE complementary_data IS NOT NULL 
LIMIT 5;

-- ============================================================================
-- 8. VERIFICAÇÃO DE VALORES NULOS
-- ============================================================================

-- Campos obrigatórios com valores nulos (não deveria haver)
SELECT 
  COUNT(CASE WHEN violation_date IS NULL THEN 1 END) as null_violation_date,
  COUNT(CASE WHEN agent_id IS NULL THEN 1 END) as null_agent_id,
  COUNT(CASE WHEN violation_type_id IS NULL THEN 1 END) as null_violation_type_id,
  COUNT(CASE WHEN location_id IS NULL THEN 1 END) as null_location_id,
  COUNT(CASE WHEN cttu_code IS NULL THEN 1 END) as null_cttu_code,
  COUNT(CASE WHEN law_code IS NULL THEN 1 END) as null_law_code,
  COUNT(CASE WHEN description IS NULL THEN 1 END) as null_description,
  COUNT(CASE WHEN location_description IS NULL THEN 1 END) as null_location_description
FROM traffic_violations;

-- ============================================================================
-- 9. ANÁLISE TEMPORAL DETALHADA
-- ============================================================================

-- Violações por dia da semana
SELECT 
  TO_CHAR(violation_date, 'Day') as day_of_week,
  COUNT(*) as violations_count
FROM traffic_violations 
GROUP BY TO_CHAR(violation_date, 'Day'), EXTRACT(DOW FROM violation_date)
ORDER BY EXTRACT(DOW FROM violation_date);

-- Violações por hora do dia
SELECT 
  EXTRACT(HOUR FROM violation_date) as hour,
  COUNT(*) as violations_count
FROM traffic_violations 
GROUP BY EXTRACT(HOUR FROM violation_date) 
ORDER BY hour;

-- ============================================================================
-- 10. REGISTROS MAIS RECENTES E MAIS ANTIGOS
-- ============================================================================

-- 5 violações mais recentes
SELECT id, violation_date, cttu_code, location_description
FROM traffic_violations 
ORDER BY violation_date DESC 
LIMIT 5;

-- 5 violações mais antigas
SELECT id, violation_date, cttu_code, location_description
FROM traffic_violations 
ORDER BY violation_date ASC 
LIMIT 5;

-- Intervalo de datas
SELECT 
  MIN(violation_date) as oldest_violation,
  MAX(violation_date) as newest_violation,
  MAX(violation_date) - MIN(violation_date) as date_range
FROM traffic_violations;

-- ============================================================================
-- 11. INVESTIGAÇÃO DE ANOMALIAS
-- ============================================================================

-- PROBLEMA IDENTIFICADO:
-- 2008: Apenas 8 registros reais (dados escassos)
-- 2025: 171.109 registros com datas futuras (ERRO DE PARSING)

-- Investigar 2008 (apenas 8 registros - dados realmente escassos)
SELECT * FROM traffic_violations 
WHERE EXTRACT(YEAR FROM violation_date) = 2008
ORDER BY violation_date;

-- Investigar 2025 (ERRO: dados futuros por parsing incorreto)
SELECT 
  TO_CHAR(violation_date, 'YYYY-MM-DD HH24:MI:SS') as formatted_date,
  COUNT(*) as count
FROM traffic_violations 
WHERE EXTRACT(YEAR FROM violation_date) = 2025
GROUP BY violation_date
ORDER BY violation_date
LIMIT 20;

-- Padrão das datas de 2025 (todas começam em 01/01/2025)
SELECT 
  DATE(violation_date) as date_only,
  COUNT(*) as violations_per_day
FROM traffic_violations 
WHERE EXTRACT(YEAR FROM violation_date) = 2025
GROUP BY DATE(violation_date)
ORDER BY date_only
LIMIT 10;

-- Verificar se todas as datas de 2025 são sequenciais
SELECT 
  MIN(violation_date) as first_2025_date,
  MAX(violation_date) as last_2025_date,
  COUNT(DISTINCT DATE(violation_date)) as unique_days,
  COUNT(*) as total_records
FROM traffic_violations 
WHERE EXTRACT(YEAR FROM violation_date) = 2025;

-- Investigar 2024 também (verificar se há padrões suspeitos)
SELECT 
  DATE(violation_date) as date_only,
  COUNT(*) as violations_per_day
FROM traffic_violations 
WHERE EXTRACT(YEAR FROM violation_date) = 2024
GROUP BY DATE(violation_date)
ORDER BY date_only DESC
LIMIT 20;

-- Verificar intervalo de datas em 2024
SELECT 
  MIN(violation_date) as first_2024_date,
  MAX(violation_date) as last_2024_date,
  COUNT(DISTINCT DATE(violation_date)) as unique_days_2024,
  COUNT(*) as total_records_2024
FROM traffic_violations 
WHERE EXTRACT(YEAR FROM violation_date) = 2024;

-- Amostra de registros de 2024
SELECT id, violation_date, cttu_code, location_description
FROM traffic_violations 
WHERE EXTRACT(YEAR FROM violation_date) = 2024
ORDER BY violation_date DESC
LIMIT 10;

-- CONCLUSÃO: Precisa investigar se 2024 também tem problemas de parsing

-- ============================================================================
-- 12. LIMPEZA DE DADOS PROBLEMÁTICOS
-- ============================================================================

-- DESCOBERTA: Arquivo original é de 2006!
-- Problema: Parsing está convertendo 2006 para outros anos incorretamente

-- Contar registros por ano (deve ser principalmente 2006)
SELECT 
  EXTRACT(YEAR FROM violation_date) as year,
  COUNT(*) as violations_count
FROM traffic_violations 
GROUP BY EXTRACT(YEAR FROM violation_date) 
ORDER BY year;

-- Manter apenas dados de 2006-2023 (excluir anos problemáticos)
SELECT 
  'Antes de 2006' as categoria,
  COUNT(*) as registros_a_remover
FROM traffic_violations 
WHERE EXTRACT(YEAR FROM violation_date) < 2006
UNION ALL
SELECT 
  'Depois de 2023' as categoria,
  COUNT(*) as registros_a_remover
FROM traffic_violations 
WHERE EXTRACT(YEAR FROM violation_date) > 2023;

-- EXECUTAR: Remover dados antes de 2006
DELETE FROM traffic_violations 
WHERE EXTRACT(YEAR FROM violation_date) < 2006;

-- EXECUTAR: Remover dados suspeitos (2024+ com padrões artificiais)
DELETE FROM traffic_violations 
WHERE EXTRACT(YEAR FROM violation_date) > 2023;

-- Verificar resultado após limpeza (deve ter principalmente 2006-2023)
SELECT 
  EXTRACT(YEAR FROM violation_date) as year,
  COUNT(*) as violations_count
FROM traffic_violations 
GROUP BY EXTRACT(YEAR FROM violation_date) 
ORDER BY year;T 
  'Antes de 2009' as categoria,
  COUNT(*) as registros_a_remover
FROM traffic_violations 
WHERE EXTRACT(YEAR FROM violation_date) < 2009
UNION ALL
SELECT 
  'Depois de 2023' as categoria,
  COUNT(*) as registros_a_remover
FROM traffic_violations 
WHERE EXTRACT(YEAR FROM violation_date) > 2023;

-- EXECUTAR: Remover dados antes de 2009
DELETE FROM traffic_violations 
WHERE EXTRACT(YEAR FROM violation_date) < 2009;

-- EXECUTAR: Remover dados suspeitos (2024+ com padrões artificiais)
DELETE FROM traffic_violations 
WHERE EXTRACT(YEAR FROM violation_date) > 2023;

-- Verificar resultado após limpeza (deve ter apenas 2009-2023)
SELECT 
  EXTRACT(YEAR FROM violation_date) as year,
  COUNT(*) as violations_count
FROM traffic_violations 
GROUP BY EXTRACT(YEAR FROM violation_date) 
ORDER BY year;tegoria,
  COUNT(*) as registros_a_remover
FROM traffic_violations 
WHERE EXTRACT(YEAR FROM violation_date) < 2009
UNION ALL
SELECT 
  'Depois de 2024' as categoria,
  COUNT(*) as registros_a_remover
FROM traffic_violations 
WHERE EXTRACT(YEAR FROM violation_date) > 2024;

-- EXECUTAR: Remover dados antes de 2009 (inclui 2008 problemático)
DELETE FROM traffic_violations 
WHERE EXTRACT(YEAR FROM violation_date) < 2009;

-- EXECUTAR: Remover dados futuros (2025+)
DELETE FROM traffic_violations 
WHERE EXTRACT(YEAR FROM violation_date) > 2024;

-- Verificar resultado após limpeza
SELECT 
  EXTRACT(YEAR FROM violation_date) as year,
  COUNT(*) as violations_count
FROM traffic_violations 
GROUP BY EXTRACT(YEAR FROM violation_date) 
ORDER BY year;

-- ============================================================================
-- 13. QUERIES PARA DEBUGGING
-- ============================================================================

-- Amostra geral dos dados (primeiros 3 registros)
SELECT * FROM traffic_violations ORDER BY id LIMIT 3;

-- Verificar estrutura da tabela
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'traffic_violations' 
ORDER BY ordinal_position;