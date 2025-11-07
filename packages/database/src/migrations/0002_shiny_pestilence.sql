-- Custom SQL migration file, put your code below! --

-- Convert coordinates field to PostGIS geometry for ciclomapa_infra
ALTER TABLE ciclomapa_infra ADD COLUMN coordinates_geom geometry(LineString, 4326);
UPDATE ciclomapa_infra SET coordinates_geom = ST_GeomFromGeoJSON(coordinates) WHERE coordinates IS NOT NULL;
ALTER TABLE ciclomapa_infra DROP COLUMN coordinates;
ALTER TABLE ciclomapa_infra RENAME COLUMN coordinates_geom TO coordinates;