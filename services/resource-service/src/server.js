import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import pg from 'pg'
import { CognitoJwtVerifier } from 'aws-jwt-verify'
import { pathToFileURL } from 'node:url'
import { validateResource } from './validation.js'

const { Pool } = pg
const app = express()
const PORT = Number(process.env.PORT || 4001)
const FRONTEND_URLS = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map(value => value.trim()).filter(Boolean)
const databaseUrl = process.env.DATABASE_URL
const userPoolId = process.env.COGNITO_USER_POOL_ID
const clientId = process.env.COGNITO_CLIENT_ID
const verifier = userPoolId && clientId
  ? CognitoJwtVerifier.create({ userPoolId, clientId, tokenUse: 'access' })
  : null

if (!databaseUrl) console.warn('DATABASE_URL is not set. Configure it in the backend environment.')
if (!verifier) console.warn('Cognito auth is not configured. Protected endpoints will return 503 until COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID are set.')
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

app.disable('x-powered-by')
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({
  origin(origin, callback) {
    if (!origin || FRONTEND_URLS.includes('*') || FRONTEND_URLS.includes(origin)) return callback(null, true)
    return callback(new Error('Origin is not allowed by CORS.'))
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(express.json({ limit: '32kb' }))

async function requireAuth(req, res, next) {
  if (!verifier) return res.status(503).json({ error: 'Authentication is not configured yet. Set the Cognito environment variables and restart the API.' })
  const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '')
  if (!match) return res.status(401).json({ error: 'Please sign in to continue.' })
  try {
    req.auth = await verifier.verify(match[1])
    return next()
  } catch {
    return res.status(401).json({ error: 'Your session is invalid or expired. Please sign in again.' })
  }
}

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ status: 'ok', service: 'resource-service', database: 'connected', authentication: verifier ? 'configured' : 'not-configured', timestamp: new Date().toISOString() })
  } catch {
    res.status(503).json({ status: 'degraded', service: 'resource-service', database: 'disconnected' })
  }
})

app.get('/api/resources', async (req, res, next) => {
  try {
    const { category, action, location, search, status = 'available', limit = '100', offset = '0' } = req.query
    const conditions = []
    const values = []
    const add = (sql, value) => { values.push(value); conditions.push(sql.replace('?', `$${values.length}`)) }
    if (status !== 'all') add('status = ?', status)
    if (category && category !== 'All') add('category = ?', category)
    if (action && action !== 'All') add('action = ?', action)
    if (location) add('location ILIKE ?', `%${String(location).slice(0, 120)}%`)
    if (search) {
      values.push(`%${String(search).slice(0, 120)}%`)
      const n = values.length
      conditions.push(`(title ILIKE $${n} OR description ILIKE $${n} OR location ILIKE $${n} OR category ILIKE $${n})`)
    }
    const safeLimit = Math.min(Math.max(Number.parseInt(String(limit), 10) || 100, 1), 200)
    const safeOffset = Math.max(Number.parseInt(String(offset), 10) || 0, 0)
    values.push(safeLimit, safeOffset)
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const result = await pool.query(
      `SELECT id, title, category, action, condition, location, description, status, created_at FROM resources ${where} ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    )
    const countResult = await pool.query(`SELECT COUNT(*)::int AS count FROM resources ${where}`, values.slice(0, values.length - 2))
    res.json({ count: countResult.rows[0].count, resources: result.rows })
  } catch (error) { next(error) }
})

app.get('/api/resources/:id', async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid resource ID.' })
    const result = await pool.query('SELECT id, title, category, action, condition, location, description, status, created_at FROM resources WHERE id = $1', [req.params.id])
    if (!result.rowCount) return res.status(404).json({ error: 'Resource not found.' })
    res.json({ resource: result.rows[0] })
  } catch (error) { next(error) }
})

app.post('/api/resources', requireAuth, async (req, res, next) => {
  try {
    const { errors, value } = validateResource(req.body)
    if (errors.length) return res.status(400).json({ error: errors.join(' ') })
    const result = await pool.query(
      `INSERT INTO resources (title, category, action, condition, location, description, owner_sub)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, title, category, action, condition, location, description, status, created_at`,
      [value.title, value.category, value.action, value.condition, value.location, value.description, req.auth.sub],
    )
    res.status(201).json({ message: 'Listing created.', resource: result.rows[0] })
  } catch (error) { next(error) }
})

app.delete('/api/resources/:id', requireAuth, async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid resource ID.' })
    const result = await pool.query('DELETE FROM resources WHERE id = $1 AND owner_sub = $2 RETURNING id', [req.params.id, req.auth.sub])
    if (!result.rowCount) {
      const exists = await pool.query('SELECT 1 FROM resources WHERE id = $1', [req.params.id])
      if (!exists.rowCount) return res.status(404).json({ error: 'Resource not found.' })
      return res.status(403).json({ error: 'You can only delete listings you created.' })
    }
    res.json({ message: 'Listing deleted.' })
  } catch (error) { next(error) }
})

app.post('/api/resources/:id/claims', requireAuth, async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid resource ID.' })
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : ''
    if (message.length > 500) return res.status(400).json({ error: 'Message must be 500 characters or fewer.' })
    const requesterName = String(req.auth.username || req.auth.sub).slice(0, 100)
    const result = await pool.query(
      `INSERT INTO claims (resource_id, requester_name, requester_email, requester_sub, message)
       SELECT id, $2, NULL, $3::text, $4 FROM resources WHERE id = $1 AND status = 'available' AND owner_sub IS DISTINCT FROM $3::text
       RETURNING id, resource_id, requester_name, status, created_at`,
      [req.params.id, requesterName, req.auth.sub, message],
    )
    if (!result.rowCount) {
      const exists = await pool.query('SELECT status, owner_sub FROM resources WHERE id = $1', [req.params.id])
      if (!exists.rowCount) return res.status(404).json({ error: 'Resource not found.' })
      if (exists.rows[0].owner_sub === req.auth.sub) return res.status(409).json({ error: 'You cannot request your own listing.' })
      return res.status(409).json({ error: 'This item is no longer available for requests.' })
    }
    res.status(201).json({ message: 'Request saved.', claim: result.rows[0] })
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'You already have a pending request for this item.' })
    next(error)
  }
})

app.use((_req, res) => res.status(404).json({ error: 'Endpoint not found.' }))
app.use((error, _req, res, _next) => {
  if (error.message === 'Origin is not allowed by CORS.') return res.status(403).json({ error: error.message })
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body contains invalid JSON.' })
  console.error('API error:', error)
  res.status(500).json({ error: 'Something went wrong. Please try again.' })
})

export async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS resources (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      title VARCHAR(120) NOT NULL,
      category VARCHAR(40) NOT NULL CHECK (category IN ('Books & Paper','Clothing','Electronics','Furniture','Household')),
      action VARCHAR(20) NOT NULL CHECK (action IN ('Donate','Reuse','Repair','Recycle')),
      condition VARCHAR(20) NOT NULL DEFAULT 'Good' CHECK (condition IN ('New','Like new','Good','Needs repair')),
      location VARCHAR(120) NOT NULL,
      description VARCHAR(1000) NOT NULL DEFAULT '',
      status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available','reserved','completed')),
      owner_sub VARCHAR(100),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query('ALTER TABLE resources ADD COLUMN IF NOT EXISTS owner_sub VARCHAR(100)')
  await pool.query('CREATE INDEX IF NOT EXISTS resources_owner_sub_idx ON resources (owner_sub)')
  await pool.query('CREATE INDEX IF NOT EXISTS resources_status_created_idx ON resources (status, created_at DESC)')
  await pool.query('CREATE INDEX IF NOT EXISTS resources_category_idx ON resources (category)')
  await pool.query(`
    CREATE TABLE IF NOT EXISTS claims (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      resource_id BIGINT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
      requester_name VARCHAR(100) NOT NULL,
      requester_email VARCHAR(254),
      requester_sub VARCHAR(100),
      message VARCHAR(500) NOT NULL DEFAULT '',
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query('ALTER TABLE claims ADD COLUMN IF NOT EXISTS requester_sub VARCHAR(100)')
  await pool.query('ALTER TABLE claims ALTER COLUMN requester_email DROP NOT NULL')
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS claims_one_pending_per_user_idx ON claims (resource_id, requester_sub) WHERE status = 'pending' AND requester_sub IS NOT NULL")
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS claims_one_pending_per_email_idx ON claims (resource_id, LOWER(requester_email)) WHERE status = 'pending' AND requester_email IS NOT NULL")
  const count = await pool.query('SELECT COUNT(*)::int AS count FROM resources')
  if (count.rows[0].count === 0) {
    await pool.query(`INSERT INTO resources (title, category, action, condition, location, description) VALUES
      ('Java Programming Book', 'Books & Paper', 'Donate', 'Good', 'Ahmedabad, Gujarat', 'A useful Java book for a student starting out.'),
      ('Everyday cotton kurta', 'Clothing', 'Reuse', 'Like new', 'Ahmedabad, Gujarat', 'Clean and gently used. Looking for a new wardrobe.'),
      ('Desk lamp', 'Household', 'Repair', 'Needs repair', 'Gandhinagar, Gujarat', 'The lamp works intermittently and may need a wiring check.'),
      ('Study chair', 'Furniture', 'Donate', 'Good', 'Ahmedabad, Gujarat', 'A sturdy chair with some cosmetic wear.'),
      ('USB keyboard', 'Electronics', 'Recycle', 'Needs repair', 'Gandhinagar, Gujarat', 'A few keys do not respond. Could be useful for parts.')
    `)
  }
}

async function start() {
  try {
    await initializeDatabase()
    const server = app.listen(PORT, '0.0.0.0', () => console.log(`resource-service listening on port ${PORT}; database initialized`))
    const shutdown = async () => { server.close(); await pool.end(); process.exit(0) }
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
  } catch (error) {
    console.error('Could not start resource-service. Check DATABASE_URL and PostgreSQL availability.', error)
    process.exit(1)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) start()
export { app, pool }
