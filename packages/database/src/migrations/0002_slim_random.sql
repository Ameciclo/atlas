CREATE SCHEMA "tv_mvs";
--> statement-breakpoint
CREATE MATERIALIZED VIEW "tv_mvs"."violations_joined" AS (
  SELECT
    tt.id,
    tt.violation_date,
    EXTRACT(YEAR  FROM tt.violation_date)::int AS year,
    EXTRACT(MONTH FROM tt.violation_date)::int AS month,
    EXTRACT(DOW   FROM tt.violation_date)::int AS weekday,
    EXTRACT(HOUR  FROM tt.violation_date)::int AS hour,
    tt.agent_id,
    tt.location_id,
    ttl.street_code,
    tt.violation_id,
    tt.cttu_code,
    ttc.law_code,
    ttc.canonical_description,
    ttc.category
  FROM traffic_tickets tt
  JOIN traffic_tickets_catalog ttc ON tt.violation_id = ttc.id
  LEFT JOIN traffic_tickets_locations ttl ON tt.location_id = ttl.location_id
);
--> statement-breakpoint
CREATE UNIQUE INDEX ON "tv_mvs"."violations_joined" ("id");
--> statement-breakpoint
CREATE INDEX ON "tv_mvs"."violations_joined" ("year");
--> statement-breakpoint
CREATE INDEX ON "tv_mvs"."violations_joined" ("street_code");
--> statement-breakpoint
CREATE INDEX ON "tv_mvs"."violations_joined" ("violation_id");
--> statement-breakpoint
CREATE INDEX ON "tv_mvs"."violations_joined" ("category");
--> statement-breakpoint
CREATE MATERIALIZED VIEW "tv_mvs"."mv_temporal" AS (
  SELECT
    year,
    month,
    weekday,
    hour,
    category,
    violation_id,
    COUNT(*)::int AS count
  FROM tv_mvs.violations_joined
  GROUP BY
    year, month, weekday, hour, category, violation_id
);
--> statement-breakpoint
CREATE UNIQUE INDEX ON "tv_mvs"."mv_temporal" ("year", "month", "weekday", "hour", "category", "violation_id");
--> statement-breakpoint
CREATE MATERIALIZED VIEW "tv_mvs"."mv_spatial" AS (
  SELECT
    year,
    month,
    street_code,
    category,
    violation_id,
    COUNT(*)::int AS count
  FROM tv_mvs.violations_joined
  WHERE street_code IS NOT NULL
  GROUP BY
    year, month, street_code, category, violation_id
);
--> statement-breakpoint
CREATE UNIQUE INDEX ON "tv_mvs"."mv_spatial" ("year", "month", "street_code", "category", "violation_id");
--> statement-breakpoint
CREATE INDEX ON "tv_mvs"."mv_spatial" ("street_code");
--> statement-breakpoint
CREATE MATERIALIZED VIEW "tv_mvs"."agent_top_violations" AS (
  SELECT DISTINCT ON (agent_id)
    agent_id,
    law_code,
    canonical_description AS description,
    COUNT(*)::int AS count
  FROM tv_mvs.violations_joined
  GROUP BY agent_id, law_code, canonical_description
  ORDER BY agent_id, count DESC
);
--> statement-breakpoint
CREATE UNIQUE INDEX ON "tv_mvs"."agent_top_violations" ("agent_id");
--> statement-breakpoint
CREATE MATERIALIZED VIEW "tv_mvs"."agent_top_violations_yearly" AS (
  SELECT DISTINCT ON (agent_id, year)
    agent_id,
    year,
    law_code,
    canonical_description AS description,
    COUNT(*)::int AS count
  FROM tv_mvs.violations_joined
  GROUP BY agent_id, year, law_code, canonical_description
  ORDER BY agent_id, year, count DESC
);
--> statement-breakpoint
CREATE UNIQUE INDEX ON "tv_mvs"."agent_top_violations_yearly" ("agent_id", "year");
--> statement-breakpoint
CREATE MATERIALIZED VIEW "tv_mvs"."category_top_violations_yearly" AS (
  SELECT DISTINCT ON (category, year)
    category,
    year,
    law_code,
    canonical_description AS description,
    COUNT(*)::int AS count
  FROM tv_mvs.violations_joined
  WHERE category IS NOT NULL
  GROUP BY category, year, law_code, canonical_description
  ORDER BY category, year, count DESC
);
--> statement-breakpoint
CREATE UNIQUE INDEX ON "tv_mvs"."category_top_violations_yearly" ("category", "year");
--> statement-breakpoint
CREATE MATERIALIZED VIEW "tv_mvs"."street_top_violation" AS (
  SELECT DISTINCT ON (street_code)
    street_code,
    description,
    violation_count,
    ROUND((violation_count * 100.0) / SUM(violation_count) OVER (PARTITION BY street_code), 2) AS percentage
  FROM (
    SELECT street_code, canonical_description AS description, COUNT(*)::int AS violation_count
    FROM tv_mvs.violations_joined
    WHERE street_code IS NOT NULL
    GROUP BY street_code, canonical_description
  ) sub
  ORDER BY street_code, violation_count DESC
);
--> statement-breakpoint
CREATE UNIQUE INDEX ON "tv_mvs"."street_top_violation" ("street_code");
