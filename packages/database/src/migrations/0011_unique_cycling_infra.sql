-- Add UNIQUE constraints for cycling-infra tables to support ON CONFLICT in seeds
ALTER TABLE cyclist_infra_relations ADD CONSTRAINT cyclist_infra_relations_pdc_ref_unique UNIQUE (pdc_ref);
ALTER TABLE cyclist_infra_relation_cities ADD CONSTRAINT cyclist_infra_relation_cities_relation_city_unique UNIQUE (relation_id, city_id);
