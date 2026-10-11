import { ClaimModel } from '../models/claim.model.js'
import { publishClaimCreated, publishClaimStatusUpdated } from '../events/claim.events.js'

const RESOURCE_SERVICE_URL = process.env.RESOURCE_SERVICE_URL || 'http://localhost:4001'

export class ClaimService {
  /**
   * Submit a new claim for an item
   */
  static async createClaim({ resourceId, message }, user) {
    // 1. Fetch resource metadata from resource-service
    let resource
    try {
      const response = await fetch(`${RESOURCE_SERVICE_URL}/api/resources/${resourceId}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      })
      if (!response.ok) {
        const error = new Error('The requested item does not exist.')
        error.statusCode = 404
        throw error
      }
      const data = await response.json()
      resource = data.resource
    } catch (err) {
      if (err.statusCode) throw err
      console.warn(`[claim-service] Resource service fetch fallback: ${err.message}`)
      // Fallback: minimal mock object if resource-service is starting up
      resource = { id: resourceId, title: `Item #${resourceId}`, status: 'available' }
    }

    // 2. Prevent owner from claiming their own item
    if (resource.owner_id && String(resource.owner_id) === String(user.userId)) {
      const error = new Error('You cannot request your own listed item.')
      error.statusCode = 409
      throw error
    }

    // 3. Ensure item is currently available
    if (resource.status && resource.status !== 'available') {
      const error = new Error('This item is no longer available for requests.')
      error.statusCode = 409
      throw error
    }

    // 4. Save claim in database
    const newClaim = await ClaimModel.create({
      resourceId,
      resourceTitle: resource.title || `Item #${resourceId}`,
      requesterId: user.userId,
      requesterName: user.name,
      requesterEmail: user.email,
      ownerId: resource.owner_id || null,
      ownerEmail: resource.owner_email || null,
      message,
    })

    // 5. Publish event for notification worker (plugs into RabbitMQ/Kafka in the future)
    void publishClaimCreated(newClaim)

    return newClaim
  }

  /**
   * Fetch user's claim activity (both incoming on their listings and outgoing)
   */
  static async getMyClaims(userId) {
    const [received, sent] = await Promise.all([
      ClaimModel.findReceivedByOwner(userId),
      ClaimModel.findSentByRequester(userId),
    ])

    return { received, sent }
  }

  /**
   * Owner approves or rejects an incoming claim
   */
  static async updateClaimStatus(claimId, status, user) {
    const updatedClaim = await ClaimModel.updateStatusByOwner(claimId, user.userId, status)
    if (!updatedClaim) {
      const error = new Error('Claim not found or you do not have permission to manage it.')
      error.statusCode = 404
      throw error
    }

    // If approved, notify resource-service to mark item as 'reserved'
    if (status === 'approved') {
      fetch(`${RESOURCE_SERVICE_URL}/api/resources/${updatedClaim.resource_id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.rawToken || ''}`,
        },
        body: JSON.stringify({ status: 'reserved' }),
      }).catch(err => console.error('[claim-service] Resource status sync error:', err.message))
    }

    // Publish event for notification worker (plugs into RabbitMQ/Kafka in the future)
    void publishClaimStatusUpdated(updatedClaim)

    return updatedClaim
  }
}
