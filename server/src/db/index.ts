import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { config } from '../config.js'
import * as schema from './schema/index.js'

let client: ReturnType<typeof postgres> | null = null

function getClient() {
  if (!client) {
    if (!config.databaseUrl || config.databaseUrl.startsWith('sqlite')) {
      throw new Error('DATABASE_URL must be a PostgreSQL connection string for the Express server')
    }
    client = postgres(config.databaseUrl, { prepare: false })
  }
  return client
}

export const db = drizzle(getClient(), { schema })

export type Db = typeof db
