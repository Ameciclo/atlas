-- Enable PostGIS extension if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geometry column to cyclist_profiles table
ALTER TABLE cyclist_profiles 
ADD COLUMN coordinates geometry(Point, 4326);

-- Create spatial index for better performance
CREATE INDEX idx_cyclist_profiles_coordinates ON cyclist_profiles USING GIST (coordinates);