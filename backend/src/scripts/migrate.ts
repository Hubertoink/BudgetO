import 'dotenv/config'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Pool } from 'pg'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is required')
    process.exit(1)
  }

  const pool = new Pool({ connectionString })

  try {
    console.log('🔄 Running database migrations...')

    const migrationPath = join(__dirname, '../../migrations/001_initial_schema.sql')
    const sql = readFileSync(migrationPath, 'utf-8')

    await pool.query(sql)

    console.log('✅ Migrations completed successfully')
  } catch (err) {
    console.error('❌ Migration failed:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

runMigrations()
