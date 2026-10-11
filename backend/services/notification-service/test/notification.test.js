import test from 'node:test'
import assert from 'node:assert/strict'
import { ROUTING_KEYS, QUEUE_NAME, EXCHANGE_NAME } from '../config/rabbitmq.js'
import { EmailService } from '../services/email.service.js'

test('RabbitMQ configuration has expected topics and queue', () => {
  assert.equal(EXCHANGE_NAME, 'resource_events')
  assert.equal(QUEUE_NAME, 'notification_queue')
  assert.ok(ROUTING_KEYS.includes('claim.created'))
  assert.ok(ROUTING_KEYS.includes('claim.status_updated'))
})

test('EmailService safely skips claim notification when ownerEmail is missing', async () => {
  const result = await EmailService.sendClaimCreatedNotification({
    ownerEmail: '',
    resourceTitle: 'Organic Compost',
  })
  assert.equal(result.skipped, true)
  assert.equal(result.reason, 'missing_owner_email')
})

test('EmailService safely skips status notification when requesterEmail is missing', async () => {
  const result = await EmailService.sendClaimStatusNotification({
    requesterEmail: '',
    resourceTitle: 'Garden Tools',
    status: 'approved',
  })
  assert.equal(result.skipped, true)
  assert.equal(result.reason, 'missing_requester_email')
})
