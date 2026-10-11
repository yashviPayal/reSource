import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg

const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/auth_db'
const isSsl = process.env.DATABASE_SSL === 'true'

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isSsl ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

export async function initializeDatabase() {
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(254) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users (LOWER(email));
    `)
    console.log('[auth-service] Database initialized and users table ready.')
  } finally {
    client.release()
  }
}
