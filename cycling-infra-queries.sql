-- ============================================================================
-- QUERIES SQL EQUIVALENTES ÀS APIS DO CYCLING-INFRA
-- ============================================================================

-- 1. GET /health - Verificar conexão com banco
SELECT 'connected' as database_status;

-- 2. GET /v1/infrastructure - Listar infraestrutura ciclística (ciclomapa)
SELECT 
    id,
    osm_id,
    name,
    infra_type,
    coordinates,
    geojson,
    created_at,
    updated_at
FROM ciclomapa_infra
ORDER BY id
LIMIT 100;

-- 2.1. GET /v1/infrastructure?type=Ciclofaixa - Filtrar por tipo
SELECT 
    id,
    osm_id,
    name,
    infra_type,
    coordinates,
    geojson,
    created_at,
    updated_at
FROM ciclomapa_infra
WHERE infra_type = 'Ciclofaixa'
ORDER BY id
LIMIT 100;

-- 3. GET /v1/infrastructure/{id} - Buscar infraestrutura por ID
SELECT 
    id,
    osm_id,
    name,
    infra_type,
    coordinates,
    geojson,
    created_at,
    updated_at
FROM ciclomapa_infra
WHERE id = 4721;

-- 4. GET /v1/relations - Listar todas as relações PDC
SELECT 
    id,
    osm_id,
    pdc_ref,
    pdc_typology,
    name,
    pdc_stretch,
    pdc_cities,
    pdc_notes,
    notes,
    pdc_km,
    created_at,
    updated_at
FROM cyclist_infra_relations
ORDER BY id;

-- 5. GET /v1/relations/{id}/ways - Buscar ways de uma relação específica
-- PROBLEMA: O código está procurando por osm_id = 'relation/{id}' mas deveria usar o ID interno
-- Query correta seria:
SELECT 
    prw.id,
    prw.osm_id,
    prw.relation_id,
    prw.name,
    prw.geometry_type,
    prw.coordinates,
    prw.osm_properties,
    prw.geojson,
    prw.created_at,
    prw.updated_at
FROM pdc_relation_ways prw
WHERE prw.relation_id = 2;

-- Query que o código está tentando fazer (INCORRETA):
-- SELECT * FROM pdc_relation_ways 
-- WHERE relation_id = (
--     SELECT id FROM cyclist_infra_relations 
--     WHERE osm_id = 'relation/2'
-- );

-- 6. GET /v1/ways - Listar todos os ways PDC
SELECT 
    id,
    osm_id,
    relation_id,
    name,
    geometry_type,
    coordinates,
    osm_properties,
    geojson,
    created_at,
    updated_at
FROM pdc_relation_ways
ORDER BY id;

-- 7. GET /v1/ways/summary - Estatísticas de implementação PDC
-- Esta query é mais complexa e envolve análise entre PDC e infraestrutura existente
WITH pdc_analysis AS (
    SELECT 
        CASE 
            WHEN prw.osm_id IN (SELECT osm_id FROM ciclomapa_infra) THEN 'pdc_feito'
            ELSE 'pdc_nao_feito'
        END as status,
        cir.pdc_cities,
        COUNT(*) as count_ways
    FROM pdc_relation_ways prw
    JOIN cyclist_infra_relations cir ON prw.relation_id = cir.id
    WHERE cir.pdc_ref != 'NOTPDC'
    GROUP BY status, cir.pdc_cities
),
out_pdc AS (
    SELECT 
        COUNT(*) as count_ways
    FROM ciclomapa_infra ci
    WHERE ci.osm_id NOT IN (SELECT osm_id FROM pdc_relation_ways)
)
SELECT 
    'summary' as type,
    (SELECT COALESCE(SUM(count_ways), 0) FROM pdc_analysis WHERE status = 'pdc_feito') as pdc_feito,
    (SELECT count_ways FROM out_pdc) as out_pdc,
    (SELECT COALESCE(SUM(count_ways), 0) FROM pdc_analysis) as pdc_total;

-- 8. GET /v1/ways/all-ways - Todos os ways como GeoJSON
-- Esta query retorna dados formatados como GeoJSON FeatureCollection
SELECT 
    jsonb_build_object(
        'type', 'FeatureCollection',
        'features', jsonb_agg(
            jsonb_build_object(
                'type', 'Feature',
                'geometry', geojson->'geometry',
                'properties', jsonb_build_object(
                    'STATUS', CASE 
                        WHEN prw.osm_id IN (SELECT osm_id FROM ciclomapa_infra) THEN 'Realizada'
                        ELSE 'Projeto'
                    END
                ) || (geojson->'properties')
            )
        )
    ) as geojson_collection
FROM pdc_relation_ways prw
JOIN cyclist_infra_relations cir ON prw.relation_id = cir.id
WHERE cir.pdc_ref != 'NOTPDC';

-- ============================================================================
-- QUERIES DE DIAGNÓSTICO
-- ============================================================================

-- Verificar quantas relações existem
SELECT COUNT(*) as total_relations FROM cyclist_infra_relations;

-- Verificar quantos ways existem por relação
SELECT 
    cir.id,
    cir.name,
    cir.pdc_ref,
    COUNT(prw.id) as ways_count
FROM cyclist_infra_relations cir
LEFT JOIN pdc_relation_ways prw ON cir.id = prw.relation_id
GROUP BY cir.id, cir.name, cir.pdc_ref
ORDER BY ways_count DESC;

-- Verificar se existem ways para a relação ID 2
SELECT COUNT(*) as ways_for_relation_2 
FROM pdc_relation_ways 
WHERE relation_id = 2;

-- Verificar o osm_id da relação ID 2
SELECT id, osm_id, name, pdc_ref 
FROM cyclist_infra_relations 
WHERE id = 2;