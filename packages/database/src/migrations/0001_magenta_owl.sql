-- Custom SQL migration file, put your code below! --
ALTER TABLE pdc_relation_ways ADD COLUMN geometry_new geometry;
UPDATE pdc_relation_ways SET geometry_new = ST_GeomFromGeoJSON(geojson->'geometry');
ALTER TABLE pdc_relation_ways DROP COLUMN coordinates;
ALTER TABLE pdc_relation_ways RENAME COLUMN geometry_new TO coordinates;