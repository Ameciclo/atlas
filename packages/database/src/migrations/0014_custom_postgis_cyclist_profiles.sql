-- Custom SQL migration file, put your code below! --
-- Convert cyclist_profiles.coordinates from text to geometry(Point, 4326)
ALTER TABLE cyclist_profiles ADD COLUMN coordinates_new geometry(Point, 4326);
UPDATE cyclist_profiles SET coordinates_new = ST_SetSRID(coordinates::geometry, 4326) WHERE coordinates IS NOT NULL;
ALTER TABLE cyclist_profiles DROP COLUMN coordinates;
ALTER TABLE cyclist_profiles RENAME COLUMN coordinates_new TO coordinates;
CREATE INDEX IF NOT EXISTS idx_cyclist_profiles_coordinates ON cyclist_profiles USING GIST (coordinates);
