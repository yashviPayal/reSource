import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg

const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/claim_db'
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
      CREATE TABLE IF NOT EXISTS claims (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        resource_id BIGINT NOT NULL,
        resource_title VARCHAR(120),
        requester_id BIGINT,
        requester_name VARCHAR(100) NOT NULL,
        requester_email VARCHAR(254),
        owner_id BIGINT,
        owner_email VARCHAR(254),
        message VARCHAR(500) NOT NULL DEFAULT '',
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE claims ADD COLUMN IF NOT EXISTS resource_title VARCHAR(120);
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS requester_id BIGINT;
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS owner_id BIGINT;
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS owner_email VARCHAR(254);
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

      CREATE INDEX IF NOT EXISTS idx_claims_resource ON claims (resource_id);
      CREATE INDEX IF NOT EXISTS idx_claims_requester ON claims (requester_id);
      CREATE INDEX IF NOT EXISTS idx_claims_owner ON claims (owner_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_claims_pending_unique
        ON claims (resource_id, requester_id)
        WHERE status = 'pending' AND requester_id IS NOT NULL;
    `)
    console.log('[claim-service] Database initialized and claims table ready.')
  } finally {
    client.release()
  }
}
