-- Debug relation_id mapping

-- 1. Ver relations disponíveis
SELECT id, osm_id, name FROM cyclist_infra_relations LIMIT 10;

-- 2. Ver ways sem relation_id
SELECT 
    osm_id,
    name,
    relation_id,
    osm_properties->>'relation_id' as original_relation_id
FROM pdc_relation_ways 
WHERE relation_id IS NULL 
LIMIT 10;

-- 3. Ver se há match entre relation_ids
SELECT 
    w.osm_properties->>'relation_id' as way_relation_id,
    r.osm_id as relation_osm_id,
    r.id as relation_db_id,
    COUNT(*) as ways_count
FROM pdc_relation_ways w
LEFT JOIN cyclist_infra_relations r ON r.osm_id = CONCAT('relation/', w.osm_properties->>'relation_id')
GROUP BY w.osm_properties->>'relation_id', r.osm_id, r.id
ORDER BY ways_count DESC
LIMIT 10;