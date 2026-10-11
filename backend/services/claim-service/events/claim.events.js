import amqp from 'amqplib'

export const EXCHANGE_NAME = 'resource_events'
export const EXCHANGE_TYPE = 'topic'

let connection = null
let channel = null
let isConnecting = false

/**
 * Initializes or retrieves RabbitMQ publishing channel with resilience
 */
export async function getRabbitChannel() {
  if (channel) return channel
  if (isConnecting) return null

  const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'

  try {
    isConnecting = true
    connection = await amqp.connect(rabbitmqUrl)
    channel = await connection.createChannel()

    await channel.assertExchange(EXCHANGE_NAME, EXCHANGE_TYPE, { durable: true })
    console.log(`[claim-service] Connected to RabbitMQ publisher exchange "${EXCHANGE_NAME}"`)

    connection.on('error', (err) => {
      console.warn('[claim-service] RabbitMQ connection error:', err.message)
      channel = null
      connection = null
    })

    connection.on('close', () => {
      console.warn('[claim-service] RabbitMQ connection closed.')
      channel = null
      connection = null
    })

    return channel
  } catch (err) {
    console.warn(`[claim-service] Could not connect to RabbitMQ (${err.message}). Events will log locally.`)
    channel = null
    connection = null
    return null
  } finally {
    isConnecting = false
  }
}

/**
 * Publishes an event to RabbitMQ topic exchange
 */
async function publishEvent(routingKey, event) {
  try {
    const ch = await getRabbitChannel()
    const content = Buffer.from(JSON.stringify(event))

    if (ch) {
      const published = ch.publish(EXCHANGE_NAME, routingKey, content, {
        persistent: true,
        contentType: 'application/json',
      })
      console.log(`[RabbitMQ Publisher] Sent "${routingKey}" to "${EXCHANGE_NAME}":`, {
        published,
        eventType: event.eventType,
        claimId: event.payload?.claimId,
      })
      return published
    } else {
      console.log(`[RabbitMQ Publisher Simulated] Event: "${routingKey}":`, event.payload)
      return false
    }
  } catch (err) {
    console.error(`[RabbitMQ Publisher Error] Failed publishing "${routingKey}":`, err.message)
    return false
  }
}

/**
 * Publish CLAIM_CREATED event when user requests an item
 */
export async function publishClaimCreated(claim) {
  const event = {
    eventType: 'CLAIM_CREATED',
    timestamp: new Date().toISOString(),
    payload: {
      claimId: claim.id,
      resourceId: claim.resource_id,
      resourceTitle: claim.resource_title,
      requesterId: claim.requester_id,
      requesterName: claim.requester_name,
      requesterEmail: claim.requester_email,
      ownerId: claim.owner_id,
      ownerEmail: claim.owner_email,
      message: claim.message,
    },
  }

  return publishEvent('claim.created', event)
}

/**
 * Publish CLAIM_STATUS_UPDATED event when owner approves/rejects a claim
 */
export async function publishClaimStatusUpdated(claim) {
  const event = {
    eventType: 'CLAIM_STATUS_UPDATED',
    timestamp: new Date().toISOString(),
    payload: {
      claimId: claim.id,
      resourceId: claim.resource_id,
      resourceTitle: claim.resource_title,
      requesterEmail: claim.requester_email,
      requesterName: claim.requester_name,
      status: claim.status,
    },
  }

  return publishEvent('claim.status_updated', event)
}

/**
 * Gracefully close publisher connection
 */
export async function closeRabbitPublisher() {
  try {
    if (channel) await channel.close()
    if (connection) await connection.close()
  } catch (err) {
    console.error('[claim-service] Error closing RabbitMQ publisher:', err.message)
  }
}
