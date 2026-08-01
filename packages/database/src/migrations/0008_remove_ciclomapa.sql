-- Drop ciclomapa_infra table - it contained OSM-derived data, not official government data.
-- All cycling infrastructure is now sourced from pdc_relation_ways (PDC + non-PDC OSM ways).
DROP TABLE IF EXISTS ciclomapa_infra;
