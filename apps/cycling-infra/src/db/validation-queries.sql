-- ============================================================================
-- CYCLING INFRASTRUCTURE - VALIDATION QUERIES
-- ============================================================================

-- 1. CONTAGEM GERAL DE REGISTROS
SELECT 
  'cities' as table_name, COUNT(*) as total_records FROM cities
UNION ALL
SELECT 
  'cyclist_infra_relations' as table_name, COUNT(*) as total_records FROM cyclist_infra_relations
UNION ALL
SELECT 
  'pdc_relation_ways' as table_name, COUNT(*) as total_records FROM pdc_relation_ways
UNION ALL
SELECT 
  'ciclomapa_infra' as table_name, COUNT(*) as total_records FROM ciclomapa_infra;

-- 2. CIDADES POR ESTADO
SELECT state, COUNT(*) as cities_count 
FROM cities 
GROUP BY state 
ORDER BY cities_count DESC 
LIMIT 10;

-- 3. CIDADES DA RMR
SELECT COUNT(*) as rmr_cities, 
       COUNT(*) FILTER (WHERE rmr = true) as rmr_true,
       COUNT(*) FILTER (WHERE rmr = false) as rmr_false
FROM cities;

-- 4. RELAÇÕES PDC POR TIPOLOGIA
SELECT pdc_typology, COUNT(*) as count
FROM cyclist_infra_relations 
WHERE pdc_typology IS NOT NULL
GROUP BY pdc_typology
ORDER BY count DESC;

-- 5. RELAÇÕES PDC POR STATUS
SELECT notes, COUNT(*) as count
FROM cyclist_infra_relations 
WHERE notes IS NOT NULL
GROUP BY notes
ORDER BY count DESC;

-- 6. WAYS POR TIPO DE GEOMETRIA
SELECT geometry_type, COUNT(*) as count
FROM pdc_relation_ways
GROUP BY geometry_type
ORDER BY count DESC;

-- 7. CICLOMAPA POR TIPO DE INFRAESTRUTURA
SELECT infra_type, COUNT(*) as count
FROM ciclomapa_infra
GROUP BY infra_type
ORDER BY count DESC;

-- 8. VALIDAÇÃO DE COORDENADAS POSTGIS (se já convertidas)
-- Verificar se as geometrias são válidas
SELECT 
  'ciclomapa_infra' as table_name,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE ST_IsValid(coordinates)) as valid_geometries,
  COUNT(*) FILTER (WHERE NOT ST_IsValid(coordinates)) as invalid_geometries
FROM ciclomapa_infra
WHERE coordinates IS NOT NULL;

SELECT 
  'pdc_relation_ways' as table_name,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE ST_IsValid(coordinates)) as valid_geometries,
  COUNT(*) FILTER (WHERE NOT ST_IsValid(coordinates)) as invalid_geometries
FROM pdc_relation_ways
WHERE coordinates IS NOT NULL;

-- 9. SAMPLE DE DADOS CICLOMAPA
SELECT osm_id, name, infra_type, 
       ST_GeometryType(coordinates) as geom_type,
       ST_SRID(coordinates) as srid
FROM ciclomapa_infra 
LIMIT 5;

-- 10. SAMPLE DE DADOS WAYS
SELECT osm_id, geometry_type,
       ST_GeometryType(coordinates) as geom_type,
       ST_SRID(coordinates) as srid,
       jsonb_object_keys(osm_properties) as property_keys
FROM pdc_relation_ways 
LIMIT 3;

-- 11. VERIFICAR CAMPOS NULOS
SELECT 
  COUNT(*) FILTER (WHERE osm_id IS NULL) as null_osm_id,
  COUNT(*) FILTER (WHERE name IS NULL) as null_name,
  COUNT(*) FILTER (WHERE infra_type IS NULL) as null_infra_type,
  COUNT(*) FILTER (WHERE coordinates IS NULL) as null_coordinates
FROM ciclomapa_infra;

-- 12. ANÁLISE GEOESPACIAL (se PostGIS ativo)
-- Bounding box das geometrias
SELECT 
  ST_Extent(coordinates) as bbox_ciclomapa
FROM ciclomapa_infra;

SELECT 
  ST_Extent(coordinates) as bbox_ways  
FROM pdc_relation_ways;