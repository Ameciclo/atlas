-- Create city_boundaries table with PostGIS geometry
-- Stores municipal boundaries from IBGE for point-in-polygon city_id assignment

CREATE TABLE IF NOT EXISTS city_boundaries (
  id SERIAL PRIMARY KEY,
  city_id INTEGER NOT NULL UNIQUE REFERENCES cities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  boundary geometry(MultiPolygon, 4326) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_city_boundaries_boundary_gist ON city_boundaries USING GIST (boundary);
