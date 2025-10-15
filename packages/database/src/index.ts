export {
  createDatabase,
  createConnectedDatabase,
  closeDatabase,
  type DatabaseConfig,
  type AtlasDatabase
} from './connection.js'
export { createSchemaManager, type SchemaManager } from './schema-manager.js'
export { runMigrations } from './migrate.js'

// Re-export commonly used Drizzle utilities
export {
  sql,
  eq,
  ne,
  gt,
  gte,
  lt,
  lte,
  isNull,
  isNotNull,
  inArray,
  notInArray,
  exists,
  notExists,
  between,
  notBetween,
  like,
  ilike,
  notLike,
  notIlike,
  and,
  or,
  not,
  asc,
  desc
} from 'drizzle-orm'

export {
  pgTable,
  pgSchema,
  serial,
  integer,
  bigint,
  boolean,
  text,
  varchar,
  char,
  numeric,
  real,
  doublePrecision,
  timestamp,
  date,
  time,
  interval,
  json,
  jsonb,
  uuid,
  primaryKey,
  foreignKey,
  unique,
  check,
  index
} from 'drizzle-orm/pg-core'

export {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema
} from 'drizzle-zod'
