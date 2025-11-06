-- Verificar ways inseridas
SELECT 
    COUNT(*) as total_ways,
    COUNT(CASE WHEN coordinates IS NOT NULL THEN 1 END) as with_coordinates,
    COUNT(CASE WHEN coordinates IS NULL THEN 1 END) as without_coordinates,
    COUNT(CASE WHEN relation_id IS NOT NULL THEN 1 END) as with_relation,
    COUNT(DISTINCT geometry_type) as geometry_types
FROM pdc_relation_ways;

-- Ver exemplos das ways inseridas
SELECT 
    osm_id,
    name,
    geometry_type,
    CASE WHEN coordinates IS NULL THEN 'NULL' ELSE 'OK' END as coords_status,
    relation_id,
    (osm_properties->>'length')::float as length_km,
    osm_properties->>'cycleway_typology' as typology
FROM pdc_relation_ways 
ORDER BY created_at DESC 
LIMIT 10;

-- Verificar tipos de geometria
SELECT 
    geometry_type,
    COUNT(*) as count
FROM pdc_relation_ways 
GROUP BY geometry_type;