-- Link emergency_calls to pcr_streets via pcr_address = nlogra_conc
-- This enables fast JOINs instead of expensive LIKE-based fuzzy matching

ALTER TABLE emergency_calls
ADD COLUMN pcr_street_id INTEGER REFERENCES pcr_streets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_emergency_calls_pcr_street_id
ON emergency_calls(pcr_street_id);

CREATE INDEX IF NOT EXISTS idx_pcr_streets_nlogra_conc
ON pcr_streets(nlogra_conc);
