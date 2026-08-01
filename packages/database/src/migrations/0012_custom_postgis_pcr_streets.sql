-- Custom SQL migration file, put your code below! --
-- Enable PostGIS and convert pcr_streets.coordinates from text to geometry(MultiLineString, 4326)
CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE pcr_streets ADD COLUMN coordinates_new geometry(MultiLineString, 4326);
UPDATE pcr_streets SET coordinates_new = ST_SetSRID(coordinates::geometry, 4326);
ALTER TABLE pcr_streets DROP COLUMN coordinates;
ALTER TABLE pcr_streets RENAME COLUMN coordinates_new TO coordinates;
ALTER TABLE pcr_streets ALTER COLUMN coordinates SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pcr_streets_coordinates ON pcr_streets USING GIST (coordinates);
