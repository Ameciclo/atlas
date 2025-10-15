import { pgSchema } from 'drizzle-orm/pg-core'
import type { PgSchema } from 'drizzle-orm/pg-core'
import type { AtlasDatabase } from './connection.js'

export interface SchemaManager {
  /**
   * Get or create a PostgreSQL schema for a service
   */
  getSchema(serviceName: string): PgSchema

  /**
   * Create all schemas that have been registered
   */
  createSchemas(db: AtlasDatabase): Promise<void>

  /**
   * List all registered schemas
   */
  listSchemas(): string[]

  /**
   * Check if a schema exists in the database
   */
  schemaExists(db: AtlasDatabase, schemaName: string): Promise<boolean>
}

class SchemaManagerImpl implements SchemaManager {
  private schemas = new Map<string, PgSchema>()

  getSchema (serviceName: string): PgSchema {
    const schemaName = this.normalizeSchemaName(serviceName)

    if (!this.schemas.has(schemaName)) {
      const schema = pgSchema(schemaName)
      this.schemas.set(schemaName, schema)
    }

    const schema = this.schemas.get(schemaName)
    if (!schema) {
      throw new Error(`Schema ${schemaName} not found`)
    }
    return schema
  }

  async createSchemas (db: AtlasDatabase): Promise<void> {
    const schemaNames = Array.from(this.schemas.keys())
    for (const schemaName of schemaNames) {
      try {
        await db.execute(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`)
        console.log(`✓ Schema "${schemaName}" created or already exists`)
      } catch (error) {
        console.error(`✗ Failed to create schema "${schemaName}":`, error)
        throw error
      }
    }
  }

  listSchemas (): string[] {
    return Array.from(this.schemas.keys())
  }

  async schemaExists (db: AtlasDatabase, schemaName: string): Promise<boolean> {
    const result = await db.execute(`
			SELECT EXISTS(
				SELECT 1 FROM information_schema.schemata 
				WHERE schema_name = '${schemaName}'
			) as exists
		`)

    return result.rows[0]?.exists === true
  }

  private normalizeSchemaName (serviceName: string): string {
    // Convert service names like "cyclist-profile" to "cyclist_profile"
    // PostgreSQL schema names should use underscores
    return serviceName.replace(/-/g, '_').toLowerCase()
  }
}

/**
 * Create a new schema manager instance
 */
export function createSchemaManager (): SchemaManager {
  return new SchemaManagerImpl()
}

/**
 * Global schema manager instance for convenience
 */
export const schemaManager = createSchemaManager()
