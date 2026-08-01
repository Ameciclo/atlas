-- Custom SQL migration file, put your code below! --
-- Convert pdc_relation_ways.coordinates from text to geometry using geojson column
ALTER TABLE pdc_relation_ways ADD COLUMN coordinates_new geometry;
UPDATE pdc_relation_ways SET coordinates_new = ST_GeomFromGeoJSON(geojson->'geometry');
ALTER TABLE pdc_relation_ways DROP COLUMN coordinates;
ALTER TABLE pdc_relation_ways RENAME COLUMN coordinates_new TO coordinates;
