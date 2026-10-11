import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { pool, initializeDatabase } from './config/db.js'
import claimRoutes from './routes/claim.routes.js'
import { errorHandler } from './middleware/error.middleware.js'

const app = express()
const PORT = Number(process.env.PORT || 4003)
const CLIENT_URL = process.env.CLIENT_URL || '*'

// Security and utility middlewares
app.disable('x-powered-by')
app.use(helmet())
app.use(cookieParser())
app.use(cors({
  origin: CLIENT_URL === '*' ? true : CLIENT_URL.split(',').map(s => s.trim()),
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(express.json({ limit: '32kb' }))

// Health Check for Docker / Kubernetes probes
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    res.status(200).json({
      status: 'ok',
      service: 'claim-service',
      database: 'connected',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    res.status(503).json({
      status: 'degraded',
      service: 'claim-service',
      database: 'disconnected',
      error: error.message,
    })
  }
})

// Mount claim routes under /api/claims
app.use('/api/claims', claimRoutes)

// 404 Handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found.' })
})

// Centralized Error Handler
app.use(errorHandler)

// Start Server
async function startServer() {
  try {
    await initializeDatabase()
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`[claim-service] Server running on http://0.0.0.0:${PORT}`)
    })

    const shutdown = async (signal) => {
      console.log(`\n[claim-service] Received ${signal}. Shutting down gracefully...`)
      server.close(async () => {
        await pool.end()
        console.log('[claim-service] Database pool closed. Process terminated.')
        process.exit(0)
      })
    }

    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))
  } catch (error) {
    console.error('[claim-service] Fatal startup error:', error)
    process.exit(1)
  }
}

startServer()

export default app
