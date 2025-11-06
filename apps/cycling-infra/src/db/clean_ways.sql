-- Limpar TODAS as tabelas de cycling infra e reiniciar serials

-- 1. Truncar relation-cities (tem FK)
TRUNCATE TABLE cyclist_infra_relation_cities CASCADE;

-- 2. Truncar ways e reiniciar serial
TRUNCATE TABLE pdc_relation_ways RESTART IDENTITY CASCADE;

-- 3. Truncar ciclomapa e reiniciar serial
TRUNCATE TABLE ciclomapa_infra RESTART IDENTITY CASCADE;

-- 4. Truncar relations e reiniciar serial
TRUNCATE TABLE cyclist_infra_relations RESTART IDENTITY CASCADE;

-- 5. Truncar cities (se necessário)
-- TRUNCATE TABLE cities RESTART IDENTITY CASCADE;

-- Verificar limpeza
SELECT 
    'relation_cities' as table_name, COUNT(*) as count FROM cyclist_infra_relation_cities
UNION ALL
SELECT 
    'ways' as table_name, COUNT(*) as count FROM pdc_relation_ways
UNION ALL
SELECT 
    'ciclomapa' as table_name, COUNT(*) as count FROM ciclomapa_infra
UNION ALL
SELECT 
    'relations' as table_name, COUNT(*) as count FROM cyclist_infra_relations
UNION ALL
SELECT 
    'cities' as table_name, COUNT(*) as count FROM cities;