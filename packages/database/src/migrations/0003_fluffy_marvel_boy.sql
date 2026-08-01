CREATE MATERIALIZED VIEW "tv_mvs"."mv_street_category_temporal" AS (
  WITH dims AS (
    SELECT DISTINCT street_code, category, year
    FROM tv_mvs.violations_joined
    WHERE street_code IS NOT NULL AND category IS NOT NULL
  )
  SELECT
    wd.street_code,
    wd.category,
    wd.year,
    wd.by_weekday,
    hr.by_hour,
    (SELECT SUM(x) FROM unnest(wd.by_weekday) x)::int AS total_count
  FROM (
    SELECT
      d.street_code,
      d.category,
      d.year,
      array_agg(COALESCE(cnt, 0) ORDER BY g.wd) AS by_weekday
    FROM dims d
    CROSS JOIN generate_series(0,6) AS g(wd)
    LEFT JOIN (
      SELECT street_code, category, year, weekday, COUNT(*)::int AS cnt
      FROM tv_mvs.violations_joined
      WHERE street_code IS NOT NULL AND category IS NOT NULL
      GROUP BY street_code, category, year, weekday
    ) data ON d.street_code = data.street_code
      AND d.category = data.category
      AND d.year = data.year
      AND g.wd = data.weekday
    GROUP BY d.street_code, d.category, d.year
  ) wd
  JOIN (
    SELECT
      d.street_code,
      d.category,
      d.year,
      array_agg(COALESCE(cnt, 0) ORDER BY g.hr) AS by_hour
    FROM dims d
    CROSS JOIN generate_series(0,23) AS g(hr)
    LEFT JOIN (
      SELECT street_code, category, year, hour, COUNT(*)::int AS cnt
      FROM tv_mvs.violations_joined
      WHERE street_code IS NOT NULL AND category IS NOT NULL
      GROUP BY street_code, category, year, hour
    ) data ON d.street_code = data.street_code
      AND d.category = data.category
      AND d.year = data.year
      AND g.hr = data.hour
    GROUP BY d.street_code, d.category, d.year
  ) hr ON wd.street_code = hr.street_code
    AND wd.category = hr.category
    AND wd.year = hr.year
);
--> statement-breakpoint
CREATE UNIQUE INDEX ON "tv_mvs"."mv_street_category_temporal" ("street_code", "category", "year");
--> statement-breakpoint
CREATE INDEX ON "tv_mvs"."mv_street_category_temporal" ("street_code");

--> statement-breakpoint
CREATE MATERIALIZED VIEW "tv_mvs"."mv_street_agent_temporal" AS (
  WITH dims AS (
    SELECT DISTINCT street_code, agent_id, year
    FROM tv_mvs.violations_joined
    WHERE street_code IS NOT NULL
  )
  SELECT
    wd.street_code,
    wd.agent_id,
    wd.year,
    wd.by_weekday,
    hr.by_hour,
    (SELECT SUM(x) FROM unnest(wd.by_weekday) x)::int AS total_count
  FROM (
    SELECT
      d.street_code,
      d.agent_id,
      d.year,
      array_agg(COALESCE(cnt, 0) ORDER BY g.wd) AS by_weekday
    FROM dims d
    CROSS JOIN generate_series(0,6) AS g(wd)
    LEFT JOIN (
      SELECT street_code, agent_id, year, weekday, COUNT(*)::int AS cnt
      FROM tv_mvs.violations_joined
      WHERE street_code IS NOT NULL
      GROUP BY street_code, agent_id, year, weekday
    ) data ON d.street_code = data.street_code
      AND d.agent_id = data.agent_id
      AND d.year = data.year
      AND g.wd = data.weekday
    GROUP BY d.street_code, d.agent_id, d.year
  ) wd
  JOIN (
    SELECT
      d.street_code,
      d.agent_id,
      d.year,
      array_agg(COALESCE(cnt, 0) ORDER BY g.hr) AS by_hour
    FROM dims d
    CROSS JOIN generate_series(0,23) AS g(hr)
    LEFT JOIN (
      SELECT street_code, agent_id, year, hour, COUNT(*)::int AS cnt
      FROM tv_mvs.violations_joined
      WHERE street_code IS NOT NULL
      GROUP BY street_code, agent_id, year, hour
    ) data ON d.street_code = data.street_code
      AND d.agent_id = data.agent_id
      AND d.year = data.year
      AND g.hr = data.hour
    GROUP BY d.street_code, d.agent_id, d.year
  ) hr ON wd.street_code = hr.street_code
    AND wd.agent_id = hr.agent_id
    AND wd.year = hr.year
);
--> statement-breakpoint
CREATE UNIQUE INDEX ON "tv_mvs"."mv_street_agent_temporal" ("street_code", "agent_id", "year");
--> statement-breakpoint
CREATE INDEX ON "tv_mvs"."mv_street_agent_temporal" ("street_code");
