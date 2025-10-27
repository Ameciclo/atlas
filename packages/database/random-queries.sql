-- ============================================================================
-- TESTES SQL PARA TABELA BICYCLE_RACKS
-- ============================================================================

-- 1. CONTAGEM GERAL
-- Verificar quantos bicicletários existem no total
SELECT COUNT(*) as total_bicicletarios FROM bicycle_racks;

-- 2. VERIFICAR ESTRUTURA DA TABELA
-- Ver todas as colunas e tipos de dados
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'bicycle_racks' 
ORDER BY ordinal_position;

-- 3. AMOSTRA DE DADOS
-- Ver os primeiros 5 registros para entender a estrutura
SELECT * FROM bicycle_racks LIMIT 5;

-- 4. TESTE POSTGIS
-- Verificar se as coordenadas estão funcionando
SELECT 
    id, 
    name, 
    ST_AsText(coordinates) as coordenadas_wkt,
    ST_X(coordinates) as longitude,
    ST_Y(coordinates) as latitude
FROM bicycle_racks 
WHERE coordinates IS NOT NULL 
LIMIT 5;

-- 5. ANÁLISE POR TIPO DE ACESSO
-- Distribuição por tipo de acesso
SELECT 
    access,
    COUNT(*) as quantidade,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM bicycle_racks), 2) as percentual
FROM bicycle_racks 
GROUP BY access 
ORDER BY quantidade DESC;

-- 6. ANÁLISE POR COBERTURA
-- Quantos são cobertos vs descobertos
SELECT 
    covered,
    COUNT(*) as quantidade,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM bicycle_racks), 2) as percentual
FROM bicycle_racks 
GROUP BY covered 
ORDER BY quantidade DESC;

-- 7. ANÁLISE DE CAPACIDADE
-- Estatísticas de capacidade (apenas valores numéricos)
SELECT 
    COUNT(CASE WHEN capacity ~ '^[0-9]+$' THEN 1 END) as capacidades_numericas,
    MIN(CASE WHEN capacity ~ '^[0-9]+$' THEN CAST(capacity AS INTEGER) END) as capacidade_minima,
    MAX(CASE WHEN capacity ~ '^[0-9]+$' THEN CAST(capacity AS INTEGER) END) as capacidade_maxima,
    ROUND(AVG(CASE WHEN capacity ~ '^[0-9]+$' THEN CAST(capacity AS INTEGER) END), 2) as capacidade_media
FROM bicycle_racks;

-- 8. ANÁLISE POR OPERADOR
-- Top 10 operadores com mais bicicletários
SELECT 
    operator,
    COUNT(*) as quantidade
FROM bicycle_racks 
WHERE operator IS NOT NULL 
GROUP BY operator 
ORDER BY quantidade DESC 
LIMIT 10;

-- 9. ANÁLISE POR TIPO DE ESTACIONAMENTO
-- Distribuição por tipo de bicycle_parking
SELECT 
    bicycle_parking,
    COUNT(*) as quantidade,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM bicycle_racks), 2) as percentual
FROM bicycle_racks 
GROUP BY bicycle_parking 
ORDER BY quantidade DESC;

-- 10. BICICLETÁRIOS COM NOMES
-- Quantos têm nomes definidos
SELECT 
    COUNT(CASE WHEN name IS NOT NULL AND name != '' THEN 1 END) as com_nome,
    COUNT(CASE WHEN name IS NULL OR name = '' THEN 1 END) as sem_nome,
    COUNT(*) as total
FROM bicycle_racks;

-- 11. ANÁLISE GEOGRÁFICA - REGIÃO METROPOLITANA DO RECIFE
-- Distribuição por bairros/regiões do Recife usando coordenadas PostGIS
SELECT 
    CASE 
        WHEN ST_Y(coordinates) BETWEEN -7.9 AND -8.0 AND ST_X(coordinates) BETWEEN -34.95 AND -34.85 THEN 'Olinda'
        WHEN ST_Y(coordinates) BETWEEN -8.0 AND -8.05 AND ST_X(coordinates) BETWEEN -34.92 AND -34.85 THEN 'Recife Centro'
        WHEN ST_Y(coordinates) BETWEEN -8.05 AND -8.12 AND ST_X(coordinates) BETWEEN -34.95 AND -34.85 THEN 'Recife Zona Sul'
        WHEN ST_Y(coordinates) BETWEEN -8.1 AND -8.2 AND ST_X(coordinates) BETWEEN -35.0 AND -34.9 THEN 'Jaboatão dos Guararapes'
        WHEN ST_Y(coordinates) BETWEEN -7.85 AND -7.95 AND ST_X(coordinates) BETWEEN -34.9 AND -34.8 THEN 'Paulista'
        WHEN ST_Y(coordinates) BETWEEN -8.0 AND -8.1 AND ST_X(coordinates) BETWEEN -35.0 AND -34.95 THEN 'Recife Zona Oeste'
        ELSE 'Outras cidades da RMR'
    END as regiao,
    COUNT(*) as quantidade
FROM bicycle_racks 
WHERE coordinates IS NOT NULL 
GROUP BY 
    CASE 
        WHEN ST_Y(coordinates) BETWEEN -7.9 AND -8.0 AND ST_X(coordinates) BETWEEN -34.95 AND -34.85 THEN 'Olinda'
        WHEN ST_Y(coordinates) BETWEEN -8.0 AND -8.05 AND ST_X(coordinates) BETWEEN -34.92 AND -34.85 THEN 'Recife Centro'
        WHEN ST_Y(coordinates) BETWEEN -8.05 AND -8.12 AND ST_X(coordinates) BETWEEN -34.95 AND -34.85 THEN 'Recife Zona Sul'
        WHEN ST_Y(coordinates) BETWEEN -8.1 AND -8.2 AND ST_X(coordinates) BETWEEN -35.0 AND -34.9 THEN 'Jaboatão dos Guararapes'
        WHEN ST_Y(coordinates) BETWEEN -7.85 AND -7.95 AND ST_X(coordinates) BETWEEN -34.9 AND -34.8 THEN 'Paulista'
        WHEN ST_Y(coordinates) BETWEEN -8.0 AND -8.1 AND ST_X(coordinates) BETWEEN -35.0 AND -34.95 THEN 'Recife Zona Oeste'
        ELSE 'Outras cidades da RMR'
    END
ORDER BY quantidade DESC;

-- 12. BICICLETÁRIOS PRÓXIMOS AO CENTRO DO RECIFE
-- Usando PostGIS para calcular distâncias (centro: -8.0476, -34.8770)
SELECT 
    id,
    name,
    capacity,
    access,
    covered,
    ST_AsText(coordinates) as coordenadas,
    ST_Distance(
        coordinates::geography, 
        ST_SetSRID(ST_MakePoint(-34.8770, -8.0476), 4326)::geography
    ) as distancia_metros
FROM bicycle_racks 
WHERE coordinates IS NOT NULL
ORDER BY distancia_metros 
LIMIT 10;

-- 13. ANÁLISE POR FONTE OSM
-- Análise por tipo de elemento OSM (node, way, relation)
SELECT 
    osm_type,
    COUNT(*) as quantidade,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM bicycle_racks), 2) as percentual
FROM bicycle_racks 
GROUP BY osm_type 
ORDER BY quantidade DESC;

-- 14. BICICLETÁRIOS COM TAXAS
-- Quantos cobram taxa
SELECT 
    fee,
    COUNT(*) as quantidade
FROM bicycle_racks 
GROUP BY fee 
ORDER BY quantidade DESC;

-- 15. BICICLETÁRIOS SUPERVISIONADOS
-- Quantos têm supervisão
SELECT 
    supervised,
    COUNT(*) as quantidade
FROM bicycle_racks 
GROUP BY supervised 
ORDER BY quantidade DESC;

-- 16. BICICLETÁRIOS ILUMINADOS
-- Quantos têm iluminação
SELECT 
    lit,
    COUNT(*) as quantidade
FROM bicycle_racks 
GROUP BY lit 
ORDER BY quantidade DESC;

-- 17. ANÁLISE TEMPORAL
-- Quando foram criados os registros
SELECT 
    DATE(created_at) as data_criacao,
    COUNT(*) as quantidade
FROM bicycle_racks 
GROUP BY DATE(created_at) 
ORDER BY data_criacao DESC;

-- 18. RESUMO POR PONTOS DE INTERESSE DO RECIFE
-- Estatísticas de bicicletários por local (diferentes raios)
WITH pontos_interesse AS (
    SELECT 'Marco Zero' as local, -34.8713 as lng, -8.0631 as lat, 500 as raio
    UNION ALL SELECT 'Shopping Recife', -34.9058, -8.1178, 500
    UNION ALL SELECT 'UFPE', -34.9513, -8.0538, 1000
    UNION ALL SELECT 'Aeroporto', -34.9236, -8.1264, 2000
    UNION ALL SELECT 'Boa Viagem', -34.8956, -8.1280, 1000
)
SELECT 
    p.local,
    p.raio as raio_metros,
    COUNT(b.id) as total_bicicletarios,
    MIN(ST_Distance(
        b.coordinates::geography, 
        ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography
    )) as distancia_minima,
    MAX(ST_Distance(
        b.coordinates::geography, 
        ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography
    )) as distancia_maxima,
    ROUND(AVG(ST_Distance(
        b.coordinates::geography, 
        ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography
    ))::numeric, 2) as distancia_media
FROM pontos_interesse p
LEFT JOIN bicycle_racks b ON (
    b.coordinates IS NOT NULL 
    AND ST_DWithin(
        b.coordinates::geography, 
        ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography, 
        p.raio
    )
)
GROUP BY p.local, p.raio
ORDER BY total_bicicletarios DESC;

-- 18b. DETALHES DOS BICICLETÁRIOS PRÓXIMOS
-- Lista detalhada dos bicicletários por ponto de interesse
SELECT 
    'Marco Zero (500m)' as local, 
    id, name, capacity, operator,
    ST_Distance(coordinates::geography, ST_SetSRID(ST_MakePoint(-34.8713, -8.0631), 4326)::geography) as distancia_metros
FROM bicycle_racks 
WHERE coordinates IS NOT NULL 
    AND ST_DWithin(coordinates::geography, ST_SetSRID(ST_MakePoint(-34.8713, -8.0631), 4326)::geography, 500)
UNION ALL
SELECT 
    'UFPE (1km)', 
    id, name, capacity, operator,
    ST_Distance(coordinates::geography, ST_SetSRID(ST_MakePoint(-34.9513, -8.0538), 4326)::geography)
FROM bicycle_racks 
WHERE coordinates IS NOT NULL 
    AND ST_DWithin(coordinates::geography, ST_SetSRID(ST_MakePoint(-34.9513, -8.0538), 4326)::geography, 1000)
UNION ALL
SELECT 
    'Shopping Recife (500m)', 
    id, name, capacity, operator,
    ST_Distance(coordinates::geography, ST_SetSRID(ST_MakePoint(-34.9058, -8.1178), 4326)::geography)
FROM bicycle_racks 
WHERE coordinates IS NOT NULL 
    AND ST_DWithin(coordinates::geography, ST_SetSRID(ST_MakePoint(-34.9058, -8.1178), 4326)::geography, 500)
ORDER BY local, distancia_metros;

-- 18b. TESTE SIMPLES DE PROXIMIDADE
-- Verificar se há bicicletários próximos (raio maior para teste)
SELECT 
    'Teste proximidade' as tipo,
    COUNT(*) as total_encontrados,
    MIN(ST_Distance(coordinates::geography, ST_SetSRID(ST_MakePoint(-34.8713, -8.0631), 4326)::geography)) as distancia_minima,
    MAX(ST_Distance(coordinates::geography, ST_SetSRID(ST_MakePoint(-34.8713, -8.0631), 4326)::geography)) as distancia_maxima
FROM bicycle_racks 
WHERE coordinates IS NOT NULL 
    AND ST_DWithin(coordinates::geography, ST_SetSRID(ST_MakePoint(-34.8713, -8.0631), 4326)::geography, 5000);

-- 19. ANÁLISE DE ENDEREÇOS
-- Bicicletários com endereços completos
SELECT 
    COUNT(*) as total,
    COUNT(addr_city) as com_cidade,
    COUNT(addr_street) as com_rua,
    COUNT(addr_housenumber) as com_numero,
    COUNT(CASE WHEN addr_city IS NOT NULL AND addr_street IS NOT NULL THEN 1 END) as endereco_completo
FROM bicycle_racks;

-- 20. ESTATÍSTICAS GERAIS RESUMIDAS
-- Resumo geral dos dados
SELECT 
    'Total de bicicletários' as metrica,
    COUNT(*)::text as valor
FROM bicycle_racks
UNION ALL
SELECT 
    'Com coordenadas PostGIS',
    COUNT(CASE WHEN coordinates IS NOT NULL THEN 1 END)::text
FROM bicycle_racks
UNION ALL
SELECT 
    'Com nome definido',
    COUNT(CASE WHEN name IS NOT NULL AND name != '' THEN 1 END)::text
FROM bicycle_racks
UNION ALL
SELECT 
    'Acesso público',
    COUNT(CASE WHEN access = 'yes' THEN 1 END)::text
FROM bicycle_racks
UNION ALL
SELECT 
    'Cobertos',
    COUNT(CASE WHEN covered = 'yes' THEN 1 END)::text
FROM bicycle_racks
UNION ALL
SELECT 
    'Com operador definido',
    COUNT(CASE WHEN operator IS NOT NULL THEN 1 END)::text
FROM bicycle_racks;

-- 21. DENSIDADE DE BICICLETÁRIOS NO RECIFE
-- Análise de densidade por área (grid de 1km²)
WITH grid AS (
    SELECT 
        FLOOR(ST_X(coordinates) * 100) / 100 as lng_grid,
        FLOOR(ST_Y(coordinates) * 100) / 100 as lat_grid,
        COUNT(*) as bicicletarios_por_area
    FROM bicycle_racks 
    WHERE coordinates IS NOT NULL
        AND ST_Y(coordinates) BETWEEN -8.2 AND -7.8  -- Foco na RMR
        AND ST_X(coordinates) BETWEEN -35.1 AND -34.7
    GROUP BY FLOOR(ST_X(coordinates) * 100) / 100, FLOOR(ST_Y(coordinates) * 100) / 100
)
SELECT 
    lng_grid,
    lat_grid,
    bicicletarios_por_area,
    CASE 
        WHEN bicicletarios_por_area >= 10 THEN 'Alta densidade'
        WHEN bicicletarios_por_area >= 5 THEN 'Média densidade'
        WHEN bicicletarios_por_area >= 2 THEN 'Baixa densidade'
        ELSE 'Muito baixa densidade'
    END as classificacao_densidade
FROM grid
ORDER BY bicicletarios_por_area DESC;

-- 22. BICICLETÁRIOS POR CIDADE
-- Análise por cidade (quando disponível)
SELECT 
    addr_city,
    COUNT(*) as quantidade
FROM bicycle_racks 
WHERE addr_city IS NOT NULL 
GROUP BY addr_city 
ORDER BY quantidade DESC;

-- 23. CAPACIDADE TOTAL ESTIMADA
-- Soma da capacidade total (apenas valores numéricos)
SELECT 
    SUM(CASE WHEN capacity ~ '^[0-9]+$' THEN CAST(capacity AS INTEGER) ELSE 0 END) as capacidade_total_estimada,
    COUNT(CASE WHEN capacity ~ '^[0-9]+$' THEN 1 END) as bicicletarios_com_capacidade_definida
FROM bicycle_racks;

-- 24. ANÁLISE DE BUILDING
-- Bicicletários em prédios
SELECT 
    building,
    COUNT(*) as quantidade
FROM bicycle_racks 
WHERE building IS NOT NULL 
GROUP BY building 
ORDER BY quantidade DESC;

-- 25. ANÁLISE ESPECÍFICA DO RECIFE
-- Estatísticas focadas na cidade do Recife
WITH recife_bounds AS (
    SELECT * FROM bicycle_racks 
    WHERE coordinates IS NOT NULL
        AND ST_Y(coordinates) BETWEEN -8.15 AND -7.95  -- Limites aproximados do Recife
        AND ST_X(coordinates) BETWEEN -35.0 AND -34.8
)
SELECT 
    'Recife' as cidade,
    COUNT(*) as total_bicicletarios,
    COUNT(CASE WHEN capacity ~ '^[0-9]+$' THEN 1 END) as com_capacidade_definida,
    SUM(CASE WHEN capacity ~ '^[0-9]+$' THEN CAST(capacity AS INTEGER) ELSE 0 END) as capacidade_total,
    COUNT(CASE WHEN covered = 'yes' THEN 1 END) as cobertos,
    COUNT(CASE WHEN access = 'yes' THEN 1 END) as acesso_publico,
    COUNT(CASE WHEN operator IS NOT NULL THEN 1 END) as com_operador,
    ST_XMin(ST_Extent(coordinates)) as longitude_minima,
    ST_XMax(ST_Extent(coordinates)) as longitude_maxima,
    ST_YMin(ST_Extent(coordinates)) as latitude_minima,
    ST_YMax(ST_Extent(coordinates)) as latitude_maxima,
    ST_AsText(ST_Centroid(ST_Extent(coordinates))) as centro_geometrico
FROM recife_bounds;

-- 26. CORREDORES DE MOBILIDADE DO RECIFE (ANÁLISE GEOGRÁFICA GERAL)
-- Bicicletários ao longo das principais avenidas
SELECT 
    CASE 
        WHEN ST_DWithin(coordinates::geography, ST_MakeLine(ST_MakePoint(-34.8713, -8.0631), ST_MakePoint(-34.9513, -8.0538))::geography, 500) 
            THEN 'Corredor Boa Viagem - Centro'
        WHEN ST_DWithin(coordinates::geography, ST_MakeLine(ST_MakePoint(-34.8800, -8.0500), ST_MakePoint(-34.9200, -8.1000))::geography, 500) 
            THEN 'Corredor Zona Sul'
        WHEN ST_DWithin(coordinates::geography, ST_MakeLine(ST_MakePoint(-34.8713, -8.0631), ST_MakePoint(-34.8900, -7.9800))::geography, 500) 
            THEN 'Corredor Centro - Olinda'
        ELSE 'Outras áreas'
    END as corredor,
    COUNT(*) as quantidade_bicicletarios
FROM bicycle_racks 
WHERE coordinates IS NOT NULL
    AND ST_Y(coordinates) BETWEEN -8.15 AND -7.95
    AND ST_X(coordinates) BETWEEN -35.0 AND -34.8
GROUP BY 
    CASE 
        WHEN ST_DWithin(coordinates::geography, ST_MakeLine(ST_MakePoint(-34.8713, -8.0631), ST_MakePoint(-34.9513, -8.0538))::geography, 500) 
            THEN 'Corredor Boa Viagem - Centro'
        WHEN ST_DWithin(coordinates::geography, ST_MakeLine(ST_MakePoint(-34.8800, -8.0500), ST_MakePoint(-34.9200, -8.1000))::geography, 500) 
            THEN 'Corredor Zona Sul'
        WHEN ST_DWithin(coordinates::geography, ST_MakeLine(ST_MakePoint(-34.8713, -8.0631), ST_MakePoint(-34.8900, -7.9800))::geography, 500) 
            THEN 'Corredor Centro - Olinda'
        ELSE 'Outras áreas'
    END
ORDER BY quantidade_bicicletarios DESC;

-- ============================================================================
-- TESTES PARA TABELA BICYCLE_RACK_CITIES E BICICLETÁRIOS DO RECIFE
-- ============================================================================

-- 27. VERIFICAR TABELA DE CIDADES
-- Estrutura da nova tabela bicycle_rack_cities
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'bicycle_rack_cities' 
ORDER BY ordinal_position;

-- 28. CONTAGEM POR CIDADE
-- Quantos bicicletários temos mapeados por cidade
SELECT 
    city,
    state,
    COUNT(*) as quantidade
FROM bicycle_rack_cities 
GROUP BY city, state 
ORDER BY quantidade DESC;

-- 29. TESTE DO JOIN - BICICLETÁRIOS DO RECIFE
-- Query que simula o endpoint /bicycle-racks/recife
SELECT 
    br.id,
    br.name,
    br.capacity,
    br.access,
    br.covered,
    br.operator,
    br.bicycle_parking,
    brc.city,
    brc.state,
    ST_AsText(br.coordinates) as coordenadas
FROM bicycle_racks br
INNER JOIN bicycle_rack_cities brc ON br.osm_id = brc.osm_id
WHERE brc.city = 'Recife'
ORDER BY br.name
LIMIT 10;

-- 30. ESTATÍSTICAS DOS BICICLETÁRIOS DO RECIFE
-- Análise completa dos bicicletários mapeados do Recife
SELECT 
    'Total Recife' as metrica,
    COUNT(*)::text as valor
FROM bicycle_racks br
INNER JOIN bicycle_rack_cities brc ON br.osm_id = brc.osm_id
WHERE brc.city = 'Recife'
UNION ALL
SELECT 
    'Com nome',
    COUNT(CASE WHEN br.name IS NOT NULL AND br.name != '' THEN 1 END)::text
FROM bicycle_racks br
INNER JOIN bicycle_rack_cities brc ON br.osm_id = brc.osm_id
WHERE brc.city = 'Recife'
UNION ALL
SELECT 
    'Acesso público',
    COUNT(CASE WHEN br.access = 'yes' THEN 1 END)::text
FROM bicycle_racks br
INNER JOIN bicycle_rack_cities brc ON br.osm_id = brc.osm_id
WHERE brc.city = 'Recife'
UNION ALL
SELECT 
    'Cobertos',
    COUNT(CASE WHEN br.covered = 'yes' THEN 1 END)::text
FROM bicycle_racks br
INNER JOIN bicycle_rack_cities brc ON br.osm_id = brc.osm_id
WHERE brc.city = 'Recife'
UNION ALL
SELECT 
    'Com operador',
    COUNT(CASE WHEN br.operator IS NOT NULL THEN 1 END)::text
FROM bicycle_racks br
INNER JOIN bicycle_rack_cities brc ON br.osm_id = brc.osm_id
WHERE brc.city = 'Recife';

-- 31. TIPOS DE BICICLETÁRIOS NO RECIFE
-- Distribuição por tipo de bicycle_parking no Recife
SELECT 
    br.bicycle_parking,
    COUNT(*) as quantidade,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM bicycle_racks br2 INNER JOIN bicycle_rack_cities brc2 ON br2.osm_id = brc2.osm_id WHERE brc2.city = 'Recife'), 2) as percentual
FROM bicycle_racks br
INNER JOIN bicycle_rack_cities brc ON br.osm_id = brc.osm_id
WHERE brc.city = 'Recife'
GROUP BY br.bicycle_parking 
ORDER BY quantidade DESC;

-- 32. OPERADORES NO RECIFE
-- Principais operadores de bicicletários no Recife
SELECT 
    br.operator,
    COUNT(*) as quantidade
FROM bicycle_racks br
INNER JOIN bicycle_rack_cities brc ON br.osm_id = brc.osm_id
WHERE brc.city = 'Recife' AND br.operator IS NOT NULL
GROUP BY br.operator 
ORDER BY quantidade DESC;

-- 33. CAPACIDADE DOS BICICLETÁRIOS DO RECIFE
-- Análise de capacidade específica do Recife
SELECT 
    COUNT(CASE WHEN br.capacity ~ '^[0-9]+$' THEN 1 END) as com_capacidade_numerica,
    MIN(CASE WHEN br.capacity ~ '^[0-9]+$' THEN CAST(br.capacity AS INTEGER) END) as capacidade_minima,
    MAX(CASE WHEN br.capacity ~ '^[0-9]+$' THEN CAST(br.capacity AS INTEGER) END) as capacidade_maxima,
    ROUND(AVG(CASE WHEN br.capacity ~ '^[0-9]+$' THEN CAST(br.capacity AS INTEGER) END), 2) as capacidade_media,
    SUM(CASE WHEN br.capacity ~ '^[0-9]+$' THEN CAST(br.capacity AS INTEGER) ELSE 0 END) as capacidade_total_estimada
FROM bicycle_racks br
INNER JOIN bicycle_rack_cities brc ON br.osm_id = brc.osm_id
WHERE brc.city = 'Recife';

-- 34. VERIFICAR MAPEAMENTO OSM_ID
-- Conferir se os OSM IDs estão sendo mapeados corretamente
SELECT 
    'Total na tabela principal' as tabela,
    COUNT(*)::text as registros
FROM bicycle_racks
UNION ALL
SELECT 
    'Total na tabela de cidades',
    COUNT(*)::text
FROM bicycle_rack_cities
UNION ALL
SELECT 
    'OSM IDs que fazem match',
    COUNT(*)::text
FROM bicycle_racks br
INNER JOIN bicycle_rack_cities brc ON br.osm_id = brc.osm_id
UNION ALL
SELECT 
    'OSM IDs do Recife',
    COUNT(*)::text
FROM bicycle_rack_cities
WHERE city = 'Recife';

-- 35. BICICLETÁRIOS DO RECIFE COM COORDENADAS
-- Lista dos bicicletários do Recife com suas coordenadas
SELECT 
    br.id,
    br.name,
    br.osm_id,
    br.capacity,
    br.access,
    br.covered,
    ST_X(br.coordinates) as longitude,
    ST_Y(br.coordinates) as latitude,
    ST_AsText(br.coordinates) as coordenadas_wkt
FROM bicycle_racks br
INNER JOIN bicycle_rack_cities brc ON br.osm_id = brc.osm_id
WHERE brc.city = 'Recife' 
    AND br.coordinates IS NOT NULL
ORDER BY br.name
LIMIT 15;

-- 36. TESTE DE PERFORMANCE DO JOIN
-- Verificar performance da query do endpoint
EXPLAIN ANALYZE
SELECT br.*
FROM bicycle_racks br
INNER JOIN bicycle_rack_cities brc ON br.osm_id = brc.osm_id
WHERE brc.city = 'Recife'
ORDER BY br.name;

-- 37. BICICLETÁRIOS DO RECIFE POR REGIÃO
-- Distribuição geográfica dentro do Recife
SELECT 
    CASE 
        WHEN ST_Y(br.coordinates) BETWEEN -8.0 AND -8.05 AND ST_X(br.coordinates) BETWEEN -34.92 AND -34.85 THEN 'Centro/Recife Antigo'
        WHEN ST_Y(br.coordinates) BETWEEN -8.05 AND -8.12 AND ST_X(br.coordinates) BETWEEN -34.95 AND -34.85 THEN 'Zona Sul/Boa Viagem'
        WHEN ST_Y(br.coordinates) BETWEEN -8.0 AND -8.1 AND ST_X(br.coordinates) BETWEEN -35.0 AND -34.95 THEN 'Zona Oeste'
        WHEN ST_Y(br.coordinates) BETWEEN -7.95 AND -8.05 AND ST_X(br.coordinates) BETWEEN -34.95 AND -34.85 THEN 'Zona Norte'
        ELSE 'Outras regiões'
    END as regiao_recife,
    COUNT(*) as quantidade
FROM bicycle_racks br
INNER JOIN bicycle_rack_cities brc ON br.osm_id = brc.osm_id
WHERE brc.city = 'Recife' AND br.coordinates IS NOT NULL
GROUP BY 
    CASE 
        WHEN ST_Y(br.coordinates) BETWEEN -8.0 AND -8.05 AND ST_X(br.coordinates) BETWEEN -34.92 AND -34.85 THEN 'Centro/Recife Antigo'
        WHEN ST_Y(br.coordinates) BETWEEN -8.05 AND -8.12 AND ST_X(br.coordinates) BETWEEN -34.95 AND -34.85 THEN 'Zona Sul/Boa Viagem'
        WHEN ST_Y(br.coordinates) BETWEEN -8.0 AND -8.1 AND ST_X(br.coordinates) BETWEEN -35.0 AND -34.95 THEN 'Zona Oeste'
        WHEN ST_Y(br.coordinates) BETWEEN -7.95 AND -8.05 AND ST_X(br.coordinates) BETWEEN -34.95 AND -34.85 THEN 'Zona Norte'
        ELSE 'Outras regiões'
    END
ORDER BY quantidade DESC;

-- 38. COMPARAÇÃO: RECIFE vs OUTRAS CIDADES
-- Comparar estatísticas do Recife com outras cidades (se houver)
WITH stats_por_cidade AS (
    SELECT 
        brc.city,
        COUNT(*) as total,
        COUNT(CASE WHEN br.covered = 'yes' THEN 1 END) as cobertos,
        COUNT(CASE WHEN br.access = 'yes' THEN 1 END) as publicos,
        COUNT(CASE WHEN br.capacity ~ '^[0-9]+$' THEN 1 END) as com_capacidade,
        SUM(CASE WHEN br.capacity ~ '^[0-9]+$' THEN CAST(br.capacity AS INTEGER) ELSE 0 END) as capacidade_total
    FROM bicycle_racks br
    INNER JOIN bicycle_rack_cities brc ON br.osm_id = brc.osm_id
    GROUP BY brc.city
)
SELECT 
    city,
    total,
    cobertos,
    ROUND(cobertos * 100.0 / total, 1) as perc_cobertos,
    publicos,
    ROUND(publicos * 100.0 / total, 1) as perc_publicos,
    com_capacidade,
    capacidade_total
FROM stats_por_cidade
ORDER BY total DESC;