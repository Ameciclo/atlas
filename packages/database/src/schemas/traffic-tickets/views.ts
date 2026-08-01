import { sql } from "drizzle-orm";
import {
	pgMaterializedView,
	integer,
	text,
	numeric,
	timestamp,
} from "drizzle-orm/pg-core";
import { pgSchema } from "drizzle-orm/pg-core";

export const tvMvs = pgSchema("tv_mvs");

export const violationsJoinedView = tvMvs
	.materializedView("violations_joined", {
		id: integer("id").notNull(),
		violationDate: timestamp("violation_date", {
			withTimezone: true,
		}).notNull(),
		year: integer("year").notNull(),
		month: integer("month").notNull(),
		weekday: integer("weekday").notNull(),
		hour: integer("hour").notNull(),
		agentId: integer("agent_id").notNull(),
		locationId: integer("location_id"),
		streetCode: integer("street_code"),
		violationId: integer("violation_id"),
		cttuCode: text("cttu_code").notNull(),
		lawCode: text("law_code").notNull(),
		canonicalDescription: text("canonical_description").notNull(),
		category: text("category"),
	})
	.as(sql`
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
`);

export const mvTemporalView = tvMvs
	.materializedView("mv_temporal", {
		year: integer("year").notNull(),
		month: integer("month").notNull(),
		weekday: integer("weekday").notNull(),
		hour: integer("hour").notNull(),
		category: text("category"),
		violationId: integer("violation_id").notNull(),
		count: integer("count").notNull(),
	})
	.as(sql`
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
`);

export const mvSpatialView = tvMvs
	.materializedView("mv_spatial", {
		year: integer("year").notNull(),
		month: integer("month").notNull(),
		streetCode: integer("street_code"),
		category: text("category"),
		violationId: integer("violation_id").notNull(),
		count: integer("count").notNull(),
	})
	.as(sql`
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
`);

export const agentTopViolationsView = tvMvs
	.materializedView("agent_top_violations", {
		agentId: integer("agent_id").notNull(),
		lawCode: text("law_code").notNull(),
		description: text("description").notNull(),
		count: integer("count").notNull(),
	})
	.as(sql`
  SELECT DISTINCT ON (agent_id)
    agent_id,
    law_code,
    canonical_description AS description,
    COUNT(*)::int AS count
  FROM tv_mvs.violations_joined
  GROUP BY agent_id, law_code, canonical_description
  ORDER BY agent_id, count DESC
`);

export const agentTopViolationsYearlyView = tvMvs
	.materializedView("agent_top_violations_yearly", {
		agentId: integer("agent_id").notNull(),
		year: integer("year").notNull(),
		lawCode: text("law_code").notNull(),
		description: text("description").notNull(),
		count: integer("count").notNull(),
	})
	.as(sql`
  SELECT DISTINCT ON (agent_id, year)
    agent_id,
    year,
    law_code,
    canonical_description AS description,
    COUNT(*)::int AS count
  FROM tv_mvs.violations_joined
  GROUP BY agent_id, year, law_code, canonical_description
  ORDER BY agent_id, year, count DESC
`);

export const categoryTopViolationsYearlyView = tvMvs
	.materializedView("category_top_violations_yearly", {
		category: text("category").notNull(),
		year: integer("year").notNull(),
		lawCode: text("law_code").notNull(),
		description: text("description").notNull(),
		count: integer("count").notNull(),
	})
	.as(sql`
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
`);

export const mvStreetCategoryTemporal = tvMvs.materializedView(
	"mv_street_category_temporal",
	{
		streetCode: integer("street_code").notNull(),
		category: text("category").notNull(),
		year: integer("year").notNull(),
		byWeekday: integer("by_weekday").array().notNull(),
		byHour: integer("by_hour").array().notNull(),
		totalCount: integer("total_count").notNull(),
	},
);

export const mvStreetAgentTemporal = tvMvs.materializedView(
	"mv_street_agent_temporal",
	{
		streetCode: integer("street_code").notNull(),
		agentId: integer("agent_id").notNull(),
		year: integer("year").notNull(),
		byWeekday: integer("by_weekday").array().notNull(),
		byHour: integer("by_hour").array().notNull(),
		totalCount: integer("total_count").notNull(),
	},
);

export const streetTopViolationView = tvMvs
	.materializedView("street_top_violation", {
		streetCode: integer("street_code").notNull(),
		description: text("description").notNull(),
		violationCount: integer("violation_count").notNull(),
		percentage: numeric("percentage").notNull(),
	})
	.as(sql`
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
`);
