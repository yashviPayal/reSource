import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { connectRabbitMQ, closeRabbitMQ, isRabbitConnected } from './config/rabbitmq.js'
import { startNotificationConsumer } from './consumers/notification.consumer.js'

const app = express()
const PORT = Number(process.env.PORT || 4004)
const resendApiKey = process.env.RESEND_API_KEY

app.disable('x-powered-by')
app.use(helmet())
app.use(morgan('[:date[iso]] :method :url :status - :response-time ms'))
app.use(cors())
app.use(express.json())

// Health check endpoint for Docker / Kubernetes probes
app.get('/health', (_req, res) => {
  const rabbitStatus = isRabbitConnected()
  res.status(rabbitStatus ? 200 : 503).json({
    status: rabbitStatus ? 'ok' : 'degraded',
    service: 'notification-service',
    timestamp: new Date().toISOString(),
    rabbitmqConnected: rabbitStatus,
    resendConfigured: !!resendApiKey,
  })
})

const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`[notification-service] HTTP health endpoint running on http://0.0.0.0:${PORT}`)
  console.log(`[notification-service] Resend API configured: ${Boolean(resendApiKey)}`)

  // Initialize RabbitMQ connection and launch background consumer
  try {
    const rabbit = await connectRabbitMQ()
    if (rabbit?.channel) {
      await startNotificationConsumer(rabbit.channel)
    }
  } catch (err) {
    console.error('[notification-service] Failed to start consumer on launch:', err.message)
  }
})

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`\n[notification-service] Received ${signal}. Shutting down gracefully...`)
  await closeRabbitMQ()
  server.close(() => {
    console.log('[notification-service] Closed HTTP server. Exiting.')
    process.exit(0)
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

export default app
