import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg

const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/resource_db'
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
      CREATE TABLE IF NOT EXISTS resources (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        title VARCHAR(120) NOT NULL,
        category VARCHAR(40) NOT NULL CHECK (category IN ('Books & Paper','Clothing','Electronics','Furniture','Household')),
        action VARCHAR(20) NOT NULL CHECK (action IN ('Donate','Reuse','Repair','Recycle')),
        condition VARCHAR(20) NOT NULL DEFAULT 'Good' CHECK (condition IN ('New','Like new','Good','Needs repair')),
        location VARCHAR(120) NOT NULL,
        description VARCHAR(1000) NOT NULL DEFAULT '',
        status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available','reserved','completed')),
        owner_id BIGINT,
        owner_email VARCHAR(254),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE resources ADD COLUMN IF NOT EXISTS owner_id BIGINT;
      ALTER TABLE resources ADD COLUMN IF NOT EXISTS owner_email VARCHAR(254);
      CREATE INDEX IF NOT EXISTS idx_resources_status_created ON resources (status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_resources_category ON resources (category);
      CREATE INDEX IF NOT EXISTS idx_resources_owner ON resources (owner_id);
    `)

    // Seed default mock items if empty
    const countRes = await client.query('SELECT COUNT(*)::int AS count FROM resources')
    if (countRes.rows[0].count === 0) {
      await client.query(`
        INSERT INTO resources (title, category, action, condition, location, description) VALUES
        ('Java Programming Book', 'Books & Paper', 'Donate', 'Good', 'Ahmedabad, Gujarat', 'A useful Java book for a student starting out.'),
        ('Everyday cotton kurta', 'Clothing', 'Reuse', 'Like new', 'Ahmedabad, Gujarat', 'Clean and gently used. Looking for a new wardrobe.'),
        ('Desk lamp', 'Household', 'Repair', 'Needs repair', 'Gandhinagar, Gujarat', 'The lamp works intermittently and may need a wiring check.'),
        ('Study chair', 'Furniture', 'Donate', 'Good', 'Ahmedabad, Gujarat', 'A sturdy chair with some cosmetic wear.'),
        ('USB keyboard', 'Electronics', 'Recycle', 'Needs repair', 'Gandhinagar, Gujarat', 'A few keys do not respond. Could be useful for parts.')
      `)
    }

    console.log('[resource-service] Database initialized and resources table ready.')
  } finally {
    client.release()
  }
}
