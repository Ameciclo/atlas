-- Custom SQL migration file, put your code below! --

-- Enable PostGIS extension if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Convert coordinates column from text to PostGIS geometry(Point, 4326)
ALTER TABLE "shared_bike_stations" 
ALTER COLUMN "coordinates" TYPE geometry(Point, 4326) 
USING ST_GeomFromText('POINT(' || coordinates || ')', 4326);