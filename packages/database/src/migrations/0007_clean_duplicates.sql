-- Clean duplicate rows and add UNIQUE constraints to cycling-infra tables.
-- Idempotent: safe to re-run.

-- 1. Update FK references to point to the surviving relation row
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN (SELECT osm_id, MIN(id) as old_id, MAX(id) as keep_id
              FROM cyclist_infra_relations
              WHERE osm_id IS NOT NULL
              GROUP BY osm_id HAVING COUNT(*) > 1)
    LOOP
        UPDATE cyclist_infra_relation_cities SET relation_id = r.keep_id
        WHERE relation_id = r.old_id;
        UPDATE pdc_relation_ways SET relation_id = r.keep_id
        WHERE relation_id = r.old_id;
    END LOOP;
END $$;

-- 2. Delete duplicate children first (FK references)
DELETE FROM pdc_relation_ways a USING pdc_relation_ways b
WHERE a.osm_id = b.osm_id AND a.id < b.id;

DELETE FROM cyclist_infra_relation_cities a USING cyclist_infra_relation_cities b
WHERE a.relation_id = b.relation_id AND a.city_id = b.city_id AND a.id < b.id;

DELETE FROM ciclomapa_infra a USING ciclomapa_infra b
WHERE a.osm_id = b.osm_id AND a.id < b.id;

-- 3. Delete duplicate relations (parent, after FK references updated)
DELETE FROM cyclist_infra_relations a USING cyclist_infra_relations b
WHERE a.osm_id = b.osm_id AND a.id < b.id;

-- 4. Add UNIQUE constraints (idempotent via DO block — PG 16 lacks ADD CONSTRAINT IF NOT EXISTS)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cyclist_infra_relation_cities_unique_pair') THEN
        ALTER TABLE cyclist_infra_relation_cities ADD CONSTRAINT cyclist_infra_relation_cities_unique_pair UNIQUE (relation_id, city_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pdc_relation_ways_osm_id_unique') THEN
        ALTER TABLE pdc_relation_ways ADD CONSTRAINT pdc_relation_ways_osm_id_unique UNIQUE (osm_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cyclist_infra_relations_osm_id_unique') THEN
        ALTER TABLE cyclist_infra_relations ADD CONSTRAINT cyclist_infra_relations_osm_id_unique UNIQUE (osm_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ciclomapa_infra_osm_id_unique') THEN
        ALTER TABLE ciclomapa_infra ADD CONSTRAINT ciclomapa_infra_osm_id_unique UNIQUE (osm_id);
    END IF;
END $$;
