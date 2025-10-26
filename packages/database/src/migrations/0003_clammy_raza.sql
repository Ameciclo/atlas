CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE bicycle_racks ALTER COLUMN coordinates TYPE geometry(Point, 4326) USING ST_GeomFromText(coordinates, 4326);

CREATE INDEX idx_bicycle_racks_coordinates ON bicycle_racks USING GIST (coordinates);