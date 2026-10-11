import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import proxyRoutes from './routes/proxy.routes.js'

const app = express()
const PORT = Number(process.env.PORT || 4000)
const CLIENT_URL = process.env.CLIENT_URL || '*'

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:4002'
const RESOURCE_SERVICE_URL = process.env.RESOURCE_SERVICE_URL || 'http://localhost:4001'

// Security headers
app.disable('x-powered-by')
app.use(helmet())

// HTTP request logger for observability
app.use(morgan('[:date[iso]] :method :url :status - :response-time ms'))

// CORS configuration supporting credentials
app.use(cors({
  origin: CLIENT_URL === '*' ? true : CLIENT_URL.split(',').map(s => s.trim()),
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

// Health check endpoint for Gateway
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    routes: {
      auth: AUTH_SERVICE_URL,
      resources: RESOURCE_SERVICE_URL,
    },
  })
})

// Mount reverse proxy routes under /api
app.use('/api', proxyRoutes)

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'API Gateway: Route not found. Available endpoints are /api/auth/* and /api/resources/*',
  })
})

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[API Gateway Error]:', err.message || err)
  res.status(500).json({
    success: false,
    error: 'Internal Gateway Error',
    message: err.message,
  })
})

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[api-gateway] Running on http://0.0.0.0:${PORT}`)
  console.log(`[api-gateway] Routing /api/auth/*      -> ${AUTH_SERVICE_URL}`)
  console.log(`[api-gateway] Routing /api/resources/* -> ${RESOURCE_SERVICE_URL}`)
})

const shutdown = (signal) => {
  console.log(`\n[api-gateway] Received ${signal}. Shutting down gracefully...`)
  server.close(() => {
    console.log('[api-gateway] Closed all connections. Exiting.')
    process.exit(0)
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

export default app
