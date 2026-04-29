-- Queries de validação para shared bike stations

-- 1. Contagem total de registros
SELECT COUNT(*) as total_stations FROM shared_bike_stations;

-- 2. Distribuição por rede
SELECT network, COUNT(*) as count 
FROM shared_bike_stations 
GROUP BY network 
ORDER BY count DESC;

-- 3. Distribuição por operador
SELECT operator, COUNT(*) as count 
FROM shared_bike_stations 
GROUP BY operator 
ORDER BY count DESC;

-- 4. Estatísticas de capacidade
SELECT 
    MIN(capacity) as min_capacity,
    MAX(capacity) as max_capacity,
    AVG(capacity) as avg_capacity,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY capacity) as median_capacity
FROM shared_bike_stations;

-- 5. Validação de coordenadas PostGIS
SELECT 
    name,
    ST_X(coordinates) as longitude,
    ST_Y(coordinates) as latitude,
    ST_AsText(coordinates) as coordinates_text
FROM shared_bike_stations 
LIMIT 5;

-- 6. Verificação de valores nulos
SELECT 
    COUNT(*) FILTER (WHERE name IS NULL) as null_names,
    COUNT(*) FILTER (WHERE coordinates IS NULL) as null_coordinates,
    COUNT(*) FILTER (WHERE capacity IS NULL) as null_capacity,
    COUNT(*) FILTER (WHERE network IS NULL) as null_network
FROM shared_bike_stations;

-- 7. Estações por tipo de aluguel
SELECT 
    COALESCE(bicycle_rental_type, 'standard') as rental_type,
    COUNT(*) as count
FROM shared_bike_stations 
GROUP BY bicycle_rental_type 
ORDER BY count DESC;

-- 8. Estações com pagamento
SELECT 
    fee,
    payment_credit_cards,
    payment_debit_cards,
    COUNT(*) as count
FROM shared_bike_stations 
GROUP BY fee, payment_credit_cards, payment_debit_cards
ORDER BY count DESC;

-- 9. Query geoespacial - estações próximas ao centro do Recife
-- (aproximadamente -34.8813, -8.0578)
SELECT 
    name,
    capacity,
    ST_Distance(
        coordinates::geography,
        ST_Point(-34.8813, -8.0578)::geography
    ) / 1000 as distance_km
FROM shared_bike_stations 
ORDER BY distance_km 
LIMIT 10;

-- 10. Análise de dados complementares (JSONB)
SELECT 
    properties->>'amenity' as amenity,
    COUNT(*) as count
FROM shared_bike_stations 
WHERE properties IS NOT NULL
GROUP BY properties->>'amenity'
ORDER BY count DESC;

-- 11. Estações com referência
SELECT 
    COUNT(*) FILTER (WHERE ref IS NOT NULL) as with_ref,
    COUNT(*) FILTER (WHERE ref IS NULL) as without_ref
FROM shared_bike_stations;

-- 12. Bounding box das estações
SELECT 
    ST_XMin(ST_Extent(coordinates)) as min_longitude,
    ST_XMax(ST_Extent(coordinates)) as max_longitude,
    ST_YMin(ST_Extent(coordinates)) as min_latitude,
    ST_YMax(ST_Extent(coordinates)) as max_latitude
FROM shared_bike_stations;