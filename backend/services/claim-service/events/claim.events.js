/**
 * Event Publisher Abstraction for claim-service
 *
 * Designed for future plug-and-play integration with Message Brokers
 * (RabbitMQ, Apache Kafka, AWS SQS, or Redis Streams).
 */

export async function publishClaimCreated(claim) {
  // TODO: Publish message to RabbitMQ exchange / Kafka topic
  console.log('[Event Dispatcher] Event: CLAIM_CREATED ->', {
    claimId: claim.id,
    resourceId: claim.resource_id,
    resourceTitle: claim.resource_title,
    ownerEmail: claim.owner_email,
    requesterName: claim.requester_name,
    timestamp: new Date().toISOString(),
  })
}

export async function publishClaimStatusUpdated(claim) {
  // TODO: Publish message to RabbitMQ exchange / Kafka topic
  console.log('[Event Dispatcher] Event: CLAIM_STATUS_UPDATED ->', {
    claimId: claim.id,
    resourceId: claim.resource_id,
    status: claim.status,
    requesterEmail: claim.requester_email,
    timestamp: new Date().toISOString(),
  })
}
