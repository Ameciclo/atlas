-- Custom SQL migration file, put your code below! --

-- Enable PostGIS extension if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Convert coordinates in ciclomapa_infra to LineString
ALTER TABLE "ciclomapa_infra" 
ALTER COLUMN "coordinates" TYPE geometry(LineString, 4326) 
USING ST_GeomFromGeoJSON(coordinates);

-- Convert coordinates in pdc_relation_ways to generic geometry
ALTER TABLE "pdc_relation_ways" 
ALTER COLUMN "coordinates" TYPE geometry 
USING ST_GeomFromGeoJSON(coordinates);
