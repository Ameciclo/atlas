import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pkg from 'pg'
const { Client } = pkg
import * as schema from './schema.js'

async function runMigrations () {
  try {
    console.log('Connecting to database...')

    const connectionString =
      process.env.DATABASE_URL ||
      `postgres://${process.env.DB_USER || 'postgres'}:${
        process.env.DB_PASSWORD || 'postgres'
      }@${process.env.DB_HOST || 'localhost'}:${
        process.env.DB_PORT || '5432'
      }/${process.env.DB_NAME || 'atlas_dev'}`

    const client = new Client({
      connectionString,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    })

    await client.connect()

    const db = drizzle(client, { schema })

    console.log('Running migrations...')

    await migrate(db, {
      migrationsFolder: './apps/cyclist-profile/src/db/migrations'
    })

    console.log('Migrations completed successfully!')

    await client.end()

    process.exit(0)
  } catch (error) {
    console.error('Error running migrations:', error)
    process.exit(1)
  }
}

runMigrations()
