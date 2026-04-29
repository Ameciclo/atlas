-- ============================================================================
-- TRAFFIC CALLS VALIDATION QUERIES
-- ============================================================================

-- 1. Contagem total de registros
SELECT COUNT(*) as total_calls FROM traffic_calls;

-- 2. Distribuição por natureza do acidente
SELECT 
    nature,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM traffic_calls 
GROUP BY nature 
ORDER BY count DESC;

-- 3. Distribuição por ano
SELECT 
    EXTRACT(YEAR FROM datetime) as year,
    COUNT(*) as calls,
    SUM(total_victims) as total_victims,
    SUM(injured_victims) as injured,
    SUM(fatal_victims) as fatalities
FROM traffic_calls 
GROUP BY EXTRACT(YEAR FROM datetime) 
ORDER BY year;

-- 4. Distribuição por mês (todos os anos)
SELECT 
    EXTRACT(MONTH FROM datetime) as month,
    COUNT(*) as calls,
    SUM(fatal_victims) as fatalities
FROM traffic_calls 
GROUP BY EXTRACT(MONTH FROM datetime) 
ORDER BY month;

-- 5. Top 10 bairros com mais acidentes
SELECT 
    neighborhood,
    COUNT(*) as calls,
    SUM(total_victims) as victims,
    SUM(fatal_victims) as fatalities
FROM traffic_calls 
GROUP BY neighborhood 
ORDER BY calls DESC 
LIMIT 10;

-- 6. Top 10 ruas com mais acidentes
SELECT 
    street_name,
    neighborhood,
    COUNT(*) as calls,
    SUM(fatal_victims) as fatalities
FROM traffic_calls 
GROUP BY street_name, neighborhood 
ORDER BY calls DESC 
LIMIT 10;

-- 7. Estatísticas de vítimas
SELECT 
    MIN(total_victims) as min_total,
    MAX(total_victims) as max_total,
    AVG(total_victims) as avg_total,
    MIN(injured_victims) as min_injured,
    MAX(injured_victims) as max_injured,
    AVG(injured_victims) as avg_injured,
    MIN(fatal_victims) as min_fatal,
    MAX(fatal_victims) as max_fatal,
    AVG(fatal_victims) as avg_fatal
FROM traffic_calls;

-- 8. Acidentes por hora do dia
SELECT 
    EXTRACT(HOUR FROM datetime) as hour,
    COUNT(*) as calls,
    SUM(fatal_victims) as fatalities
FROM traffic_calls 
GROUP BY EXTRACT(HOUR FROM datetime) 
ORDER BY hour;

-- 9. Acidentes por dia da semana
SELECT 
    EXTRACT(DOW FROM datetime) as day_of_week,
    CASE EXTRACT(DOW FROM datetime)
        WHEN 0 THEN 'Domingo'
        WHEN 1 THEN 'Segunda'
        WHEN 2 THEN 'Terça'
        WHEN 3 THEN 'Quarta'
        WHEN 4 THEN 'Quinta'
        WHEN 5 THEN 'Sexta'
        WHEN 6 THEN 'Sábado'
    END as day_name,
    COUNT(*) as calls,
    SUM(fatal_victims) as fatalities
FROM traffic_calls 
GROUP BY EXTRACT(DOW FROM datetime) 
ORDER BY day_of_week;

-- 10. Análise de tipos de acidentes (JSONB)
SELECT 
    crash_data->>'type' as call_type,
    COUNT(*) as count
FROM traffic_calls 
WHERE crash_data->>'type' IS NOT NULL
GROUP BY crash_data->>'type' 
ORDER BY count DESC;

-- 11. Análise de veículos envolvidos (JSONB)
SELECT 
    'Carros' as vehicle_type,
    SUM((crash_data->'vehicles'->>'cars')::int) as total
FROM traffic_calls 
WHERE crash_data->'vehicles'->>'cars' IS NOT NULL
UNION ALL
SELECT 
    'Motos' as vehicle_type,
    SUM((crash_data->'vehicles'->>'motorcycles')::int) as total
FROM traffic_calls 
WHERE crash_data->'vehicles'->>'motorcycles' IS NOT NULL
UNION ALL
SELECT 
    'Pedestres' as vehicle_type,
    SUM((crash_data->'vehicles'->>'pedestrians')::int) as total
FROM traffic_calls 
WHERE crash_data->'vehicles'->>'pedestrians' IS NOT NULL
ORDER BY total DESC;

-- 12. Condições climáticas (JSONB)
SELECT 
    environmental_data->>'weather' as weather,
    COUNT(*) as calls
FROM traffic_calls 
WHERE environmental_data->>'weather' IS NOT NULL 
    AND environmental_data->>'weather' != ''
GROUP BY environmental_data->>'weather' 
ORDER BY calls DESC 
LIMIT 10;

-- 13. Verificação de valores nulos
SELECT 
    'datetime' as field, COUNT(*) as null_count FROM traffic_calls WHERE datetime IS NULL
UNION ALL
SELECT 
    'nature' as field, COUNT(*) as null_count FROM traffic_calls WHERE nature IS NULL
UNION ALL
SELECT 
    'street_name' as field, COUNT(*) as null_count FROM traffic_calls WHERE street_name IS NULL
UNION ALL
SELECT 
    'neighborhood' as field, COUNT(*) as null_count FROM traffic_calls WHERE neighborhood IS NULL
UNION ALL
SELECT 
    'coordinates' as field, COUNT(*) as null_count FROM traffic_calls WHERE coordinates IS NULL
UNION ALL
SELECT 
    'crash_data' as field, COUNT(*) as null_count FROM traffic_calls WHERE crash_data IS NULL;

-- 14. Acidentes mais graves (com mais vítimas)
SELECT 
    datetime,
    street_name,
    neighborhood,
    nature,
    total_victims,
    fatal_victims,
    crash_data->>'type' as call_type,
    crash_data->>'description' as description
FROM traffic_calls 
WHERE total_victims > 5 OR fatal_victims > 0
ORDER BY fatal_victims DESC, total_victims DESC 
LIMIT 20;

-- 15. Resumo geral
SELECT 
    'Total de chamadas' as metric, COUNT(*)::text as value FROM traffic_calls
UNION ALL
SELECT 
    'Total de vítimas' as metric, SUM(total_victims)::text as value FROM traffic_calls
UNION ALL
SELECT 
    'Total de mortes' as metric, SUM(fatal_victims)::text as value FROM traffic_calls
UNION ALL
SELECT 
    'Período' as metric, 
    MIN(DATE(datetime))::text || ' a ' || MAX(DATE(datetime))::text as value 
FROM traffic_calls
UNION ALL
SELECT 
    'Bairros únicos' as metric, COUNT(DISTINCT neighborhood)::text as value FROM traffic_calls
UNION ALL
SELECT 
    'Ruas únicas' as metric, COUNT(DISTINCT street_name)::text as value FROM traffic_calls;