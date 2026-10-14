import amqp from 'amqplib'

export const EXCHANGE_NAME = 'resource_events'
export const EXCHANGE_TYPE = 'topic'
export const QUEUE_NAME = 'notification_queue'
export const ROUTING_KEYS = ['claim.created', 'claim.status_updated', 'user.registered']

let connection = null
let channel = null
let isConnected = false

export function isRabbitConnected() {
  return isConnected
}

/**
 * Connects to RabbitMQ with automatic retry / backoff
 */
export async function connectRabbitMQ(maxRetries = 10, retryDelayMs = 3000) {
  const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[RabbitMQ] Connecting to ${rabbitmqUrl.replace(/:\/\/.*@/, '://***@')} (Attempt ${attempt}/${maxRetries})...`)
      connection = await amqp.connect(rabbitmqUrl)
      channel = await connection.createChannel()

      // Assert exchange
      await channel.assertExchange(EXCHANGE_NAME, EXCHANGE_TYPE, { durable: true })

      // Assert queue with dead-letter / durability options
      await channel.assertQueue(QUEUE_NAME, { durable: true })

      // Bind all desired routing keys
      for (const routingKey of ROUTING_KEYS) {
        await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, routingKey)
        console.log(`[RabbitMQ] Bound queue "${QUEUE_NAME}" to exchange "${EXCHANGE_NAME}" with key "${routingKey}"`)
      }

      // Prefetch 5 messages at a time for concurrent worker processing
      await channel.prefetch(5)

      isConnected = true
      console.log(`[RabbitMQ] Connected successfully. Exchange: "${EXCHANGE_NAME}", Queue: "${QUEUE_NAME}"`)

      connection.on('error', (err) => {
        console.error('[RabbitMQ] Connection error:', err.message)
        isConnected = false
      })

      connection.on('close', () => {
        console.warn('[RabbitMQ] Connection closed. Will attempt reconnecting on next cycle...')
        isConnected = false
      })

      return { connection, channel }
    } catch (err) {
      console.warn(`[RabbitMQ] Connection failed: ${err.message}. Retrying in ${retryDelayMs / 1000}s...`)
      if (attempt === maxRetries) {
        console.error('[RabbitMQ] Max connection retries reached. Service will run in degraded mode.')
        return null
      }
      await new Promise((res) => setTimeout(res, retryDelayMs))
    }
  }
}

export async function closeRabbitMQ() {
  try {
    if (channel) await channel.close()
    if (connection) await connection.close()
    isConnected = false
    console.log('[RabbitMQ] Closed connections gracefully.')
  } catch (err) {
    console.error('[RabbitMQ] Error during connection close:', err.message)
  }
}
