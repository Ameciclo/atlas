-- Debug relation mapping

-- 1. Ver todas as relations no banco
SELECT 'Relations in DB:' as info;
SELECT id, osm_id, name FROM cyclist_infra_relations ORDER BY id;

-- 2. Ver alguns relation_ids do processed_ways.json
SELECT 'Sample relation_ids from processed ways:' as info;
-- Você precisa executar isso manualmente:
-- SELECT DISTINCT relation_id FROM processed_ways LIMIT 10;

-- 3. Verificar se há match entre os formatos
SELECT 'Checking format match:' as info;
SELECT 
    r.id as db_id,
    r.osm_id as db_osm_id,
    CASE 
        WHEN r.osm_id = 'relation/15997469' THEN 'MATCH for 15997469'
        WHEN r.osm_id = 'relation/15980000' THEN 'MATCH for 15980000'
        ELSE 'NO MATCH'
    END as match_test
FROM cyclist_infra_relations r
WHERE r.osm_id IN ('relation/15997469', 'relation/15980000');