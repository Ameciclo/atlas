-- Convert coordinates column from text to PostGIS geometry for pcr_streets table
-- The coordinates are stored as JSON arrays representing MultiLineString coordinates

-- Add the PostGIS geometry column
ALTER TABLE "pcr_streets" ADD COLUMN "geometry" geometry(MultiLineString, 4326);

-- Convert JSON coordinates to PostGIS geometry
UPDATE "pcr_streets" 
SET "geometry" = ST_GeomFromGeoJSON('{"type":"MultiLineString","coordinates":' || "coordinates" || '}');

-- Drop the old text coordinates column
ALTER TABLE "pcr_streets" DROP COLUMN "coordinates";

-- Rename geometry column to coordinates
ALTER TABLE "pcr_streets" RENAME COLUMN "geometry" TO "coordinates";

-- Add spatial index for better performance
CREATE INDEX "pcr_streets_coordinates_idx" ON "pcr_streets" USING GIST ("coordinates");