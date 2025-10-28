-- ============================================================================
-- ATLAS - Traffic Crashes Database Queries
-- ============================================================================
-- Arquivo com queries para testar e explorar os dados de sinistros de trânsito

-- ============================================================================
-- 1. ESTATÍSTICAS BÁSICAS
-- ============================================================================

-- Total de sinistros por ano
SELECT 
    EXTRACT(YEAR FROM timestamp) as ano,
    COUNT(*) as total_sinistros,
    SUM(n_injured) as total_feridos,
    SUM(n_deaths) as total_mortos
FROM geolocated_crashes 
GROUP BY EXTRACT(YEAR FROM timestamp) 
ORDER BY ano;

-- Sinistros mais graves (com mortes)
SELECT 
    timestamp,
    n_injured,
    n_deaths,
    complementary_data->>'Natureza' as natureza,
    ST_AsText(coordinates) as coordenadas
FROM geolocated_crashes 
WHERE n_deaths > 0 
ORDER BY n_deaths DESC, timestamp DESC
LIMIT 20;

-- ============================================================================
-- 2. ANÁLISES TEMPORAIS
-- ============================================================================

-- Sinistros por hora do dia
SELECT 
    EXTRACT(HOUR FROM timestamp) as hora,
    COUNT(*) as total_sinistros,
    ROUND(AVG(n_injured + n_deaths), 2) as media_vitimas
FROM geolocated_crashes 
GROUP BY EXTRACT(HOUR FROM timestamp) 
ORDER BY hora;

-- Sinistros por dia da semana
SELECT 
    EXTRACT(DOW FROM timestamp) as dia_semana,
    CASE EXTRACT(DOW FROM timestamp)
        WHEN 0 THEN 'Domingo'
        WHEN 1 THEN 'Segunda'
        WHEN 2 THEN 'Terça'
        WHEN 3 THEN 'Quarta'
        WHEN 4 THEN 'Quinta'
        WHEN 5 THEN 'Sexta'
        WHEN 6 THEN 'Sábado'
    END as nome_dia,
    COUNT(*) as total_sinistros
FROM geolocated_crashes 
GROUP BY EXTRACT(DOW FROM timestamp) 
ORDER BY dia_semana;

-- Sinistros por mês
SELECT 
    EXTRACT(MONTH FROM timestamp) as mes,
    COUNT(*) as total_sinistros,
    SUM(n_injured) as feridos,
    SUM(n_deaths) as mortos
FROM geolocated_crashes 
GROUP BY EXTRACT(MONTH FROM timestamp) 
ORDER BY mes;

-- ============================================================================
-- 3. ANÁLISES POR TIPO DE SINISTRO
-- ============================================================================

-- Tipos de sinistros mais comuns
SELECT 
    complementary_data->>'Natureza' as tipo_sinistro,
    COUNT(*) as quantidade,
    SUM(n_injured) as total_feridos,
    SUM(n_deaths) as total_mortos,
    ROUND(AVG(n_injured + n_deaths), 2) as media_vitimas
FROM geolocated_crashes 
WHERE complementary_data->>'Natureza' IS NOT NULL
GROUP BY complementary_data->>'Natureza'
ORDER BY quantidade DESC;

-- Atropelamentos vs outros tipos
SELECT 
    CASE 
        WHEN complementary_data->>'Natureza' ILIKE '%atropelamento%' THEN 'Atropelamento'
        ELSE 'Outros'
    END as categoria,
    COUNT(*) as total,
    SUM(n_injured) as feridos,
    SUM(n_deaths) as mortos
FROM geolocated_crashes 
GROUP BY categoria;

-- ============================================================================
-- 4. ANÁLISES ESPACIAIS (PostGIS)
-- ============================================================================

-- Densidade de sinistros por área (usando grid de 0.01 graus)
SELECT 
    FLOOR(ST_X(coordinates) / 0.01) * 0.01 as lng_grid,
    FLOOR(ST_Y(coordinates) / 0.01) * 0.01 as lat_grid,
    COUNT(*) as sinistros_na_area,
    SUM(n_injured + n_deaths) as total_vitimas
FROM geolocated_crashes 
GROUP BY lng_grid, lat_grid
HAVING COUNT(*) > 5
ORDER BY sinistros_na_area DESC
LIMIT 20;

-- Sinistros próximos a um ponto específico (Centro do Recife)
SELECT 
    id,
    timestamp,
    n_injured + n_deaths as total_vitimas,
    complementary_data->>'Natureza' as tipo,
    ST_Distance(
        coordinates, 
        ST_GeomFromText('POINT(-34.8755 -8.0476)', 4326)
    ) * 111000 as distancia_metros
FROM geolocated_crashes 
WHERE ST_DWithin(
    coordinates, 
    ST_GeomFromText('POINT(-34.8755 -8.0476)', 4326), 
    0.01  -- ~1km
)
ORDER BY distancia_metros
LIMIT 15;

-- Pontos mais perigosos (clusters de sinistros)
WITH clusters AS (
    SELECT 
        ST_ClusterKMeans(coordinates, 50) OVER() as cluster_id,
        coordinates,
        n_injured + n_deaths as vitimas
    FROM geolocated_crashes
)
SELECT 
    cluster_id,
    COUNT(*) as sinistros_no_cluster,
    SUM(vitimas) as total_vitimas,
    ST_AsText(ST_Centroid(ST_Collect(coordinates))) as centro_cluster
FROM clusters 
GROUP BY cluster_id
HAVING COUNT(*) > 10
ORDER BY total_vitimas DESC
LIMIT 10;

-- ============================================================================
-- 5. ANÁLISES DE CONDIÇÕES
-- ============================================================================

-- Sinistros por condições climáticas
SELECT 
    complementary_data->>'Tempo' as condicao_tempo,
    COUNT(*) as total_sinistros,
    ROUND(AVG(n_injured + n_deaths), 2) as media_vitimas
FROM geolocated_crashes 
WHERE complementary_data->>'Tempo' IS NOT NULL 
    AND complementary_data->>'Tempo' != 'NI'
GROUP BY complementary_data->>'Tempo'
ORDER BY total_sinistros DESC;

-- Sinistros por condições da via
SELECT 
    complementary_data->>'CONDIÇÕES DA VIA' as condicao_via,
    COUNT(*) as total_sinistros,
    SUM(n_deaths) as total_mortos
FROM geolocated_crashes 
WHERE complementary_data->>'CONDIÇÕES DA VIA' IS NOT NULL 
    AND complementary_data->>'CONDIÇÕES DA VIA' != 'NI'
GROUP BY complementary_data->>'CONDIÇÕES DA VIA'
ORDER BY total_sinistros DESC;

-- Presença de semáforo vs sinistros
SELECT 
    CASE 
        WHEN complementary_data->>'Semáforo' ILIKE '%defeito%' THEN 'Com Defeito'
        WHEN complementary_data->>'Semáforo' ILIKE '%nao existe%' THEN 'Não Existe'
        WHEN complementary_data->>'Semáforo' = 'NI' THEN 'Não Informado'
        ELSE complementary_data->>'Semáforo'
    END as status_semaforo,
    COUNT(*) as sinistros,
    SUM(n_deaths) as mortos
FROM geolocated_crashes 
GROUP BY status_semaforo
ORDER BY sinistros DESC;

-- ============================================================================
-- 6. QUERIES AVANÇADAS
-- ============================================================================

-- Evolução temporal dos sinistros (tendência por ano)
WITH yearly_stats AS (
    SELECT 
        EXTRACT(YEAR FROM timestamp) as ano,
        COUNT(*) as sinistros,
        SUM(n_injured + n_deaths) as vitimas
    FROM geolocated_crashes 
    GROUP BY EXTRACT(YEAR FROM timestamp)
)
SELECT 
    ano,
    sinistros,
    vitimas,
    LAG(sinistros) OVER (ORDER BY ano) as sinistros_ano_anterior,
    ROUND(
        (sinistros - LAG(sinistros) OVER (ORDER BY ano)) * 100.0 / 
        NULLIF(LAG(sinistros) OVER (ORDER BY ano), 0), 2
    ) as variacao_percentual
FROM yearly_stats 
ORDER BY ano;

-- Horários mais perigosos por tipo de sinistro
SELECT 
    complementary_data->>'Natureza' as tipo,
    EXTRACT(HOUR FROM timestamp) as hora,
    COUNT(*) as sinistros,
    SUM(n_deaths) as mortos
FROM geolocated_crashes 
WHERE complementary_data->>'Natureza' IS NOT NULL
GROUP BY tipo, hora
HAVING COUNT(*) > 2
ORDER BY tipo, mortos DESC, sinistros DESC;

-- Sinistros em finais de semana vs dias úteis
SELECT 
    CASE 
        WHEN EXTRACT(DOW FROM timestamp) IN (0, 6) THEN 'Final de Semana'
        ELSE 'Dia Útil'
    END as periodo,
    COUNT(*) as total_sinistros,
    SUM(n_injured) as feridos,
    SUM(n_deaths) as mortos,
    ROUND(AVG(EXTRACT(HOUR FROM timestamp)), 1) as hora_media
FROM geolocated_crashes 
GROUP BY periodo;

-- ============================================================================
-- 7. QUERIES DE VALIDAÇÃO DOS DADOS
-- ============================================================================

-- Verificar dados inconsistentes
SELECT 
    'Coordenadas nulas' as problema,
    COUNT(*) as quantidade
FROM geolocated_crashes 
WHERE coordinates IS NULL

UNION ALL

SELECT 
    'Timestamps futuros' as problema,
    COUNT(*) as quantidade
FROM geolocated_crashes 
WHERE timestamp > NOW()

UNION ALL

SELECT 
    'Vítimas negativas' as problema,
    COUNT(*) as quantidade
FROM geolocated_crashes 
WHERE n_injured < 0 OR n_deaths < 0;

-- Distribuição geográfica (bounding box)
SELECT 
    'Latitude mínima' as metrica,
    ST_YMin(ST_Extent(coordinates)) as valor
FROM geolocated_crashes

UNION ALL

SELECT 
    'Latitude máxima' as metrica,
    ST_YMax(ST_Extent(coordinates)) as valor
FROM geolocated_crashes

UNION ALL

SELECT 
    'Longitude mínima' as metrica,
    ST_XMin(ST_Extent(coordinates)) as valor
FROM geolocated_crashes

UNION ALL

SELECT 
    'Longitude máxima' as metrica,
    ST_XMax(ST_Extent(coordinates)) as valor
FROM geolocated_crashes;