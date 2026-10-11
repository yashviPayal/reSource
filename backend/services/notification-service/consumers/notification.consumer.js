import { QUEUE_NAME } from '../config/rabbitmq.js'
import { EmailService } from '../services/email.service.js'

/**
 * Starts the RabbitMQ Consumer on the notification queue
 */
export async function startNotificationConsumer(channel) {
  if (!channel) {
    console.warn('[NotificationConsumer] Cannot start consumer: Channel is not available.')
    return
  }

  console.log(`[NotificationConsumer] Listening for messages on "${QUEUE_NAME}"...`)

  await channel.consume(
    QUEUE_NAME,
    async (msg) => {
      if (!msg) return

      const routingKey = msg.fields.routingKey
      const rawContent = msg.content.toString()
      console.log(`[NotificationConsumer] Received event: "${routingKey}" (deliveryTag: ${msg.fields.deliveryTag})`)

      try {
        const event = JSON.parse(rawContent)

        switch (routingKey) {
          case 'claim.created':
            await EmailService.sendClaimCreatedNotification(event.payload || event)
            break

          case 'claim.status_updated':
            await EmailService.sendClaimStatusNotification(event.payload || event)
            break

          default:
            console.log(`[NotificationConsumer] Unhandled routing key: "${routingKey}". Acknowledging message.`)
        }

        // Acknowledge successful processing
        channel.ack(msg)
        console.log(`[NotificationConsumer] Successfully processed & ACKed event "${routingKey}"`)
      } catch (err) {
        console.error(`[NotificationConsumer] Error processing message (${routingKey}):`, err.message)
        // If message is malformed, reject without requeue to avoid poison pill loops
        // If transient, you could requeue: channel.nack(msg, false, true)
        channel.nack(msg, false, false)
      }
    },
    { noAck: false } // Manual acknowledgment for guaranteed delivery
  )
}
