import { pool } from '../config/db.js'

export class ClaimModel {
  /**
   * Insert a new claim record
   */
  static async create({ resourceId, resourceTitle, requesterId, requesterName, requesterEmail, ownerId, ownerEmail, message }) {
    const query = `
      INSERT INTO claims (resource_id, resource_title, requester_id, requester_name, requester_email, owner_id, owner_email, message)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, resource_id, resource_title, requester_name, requester_email, owner_id, owner_email, message, status, created_at
    `
    const values = [
      resourceId,
      resourceTitle,
      requesterId,
      requesterName,
      requesterEmail,
      ownerId,
      ownerEmail,
      message,
    ]

    const { rows } = await pool.query(query, values)
    return rows[0]
  }

  /**
   * Find incoming claims on items owned by ownerId
   */
  static async findReceivedByOwner(ownerId) {
    const query = `
      SELECT id, resource_id, resource_title, requester_name, requester_email, message, status, created_at
      FROM claims
      WHERE owner_id = $1
      ORDER BY created_at DESC
    `
    const { rows } = await pool.query(query, [ownerId])
    return rows
  }

  /**
   * Find outgoing claims submitted by requesterId
   */
  static async findSentByRequester(requesterId) {
    const query = `
      SELECT id, resource_id, resource_title, owner_id, message, status, created_at
      FROM claims
      WHERE requester_id = $1
      ORDER BY created_at DESC
    `
    const { rows } = await pool.query(query, [requesterId])
    return rows
  }

  /**
   * Find single claim by ID
   */
  static async findById(id) {
    const query = `
      SELECT id, resource_id, resource_title, requester_id, requester_name, requester_email, owner_id, owner_email, message, status, created_at
      FROM claims
      WHERE id = $1
      LIMIT 1
    `
    const { rows } = await pool.query(query, [id])
    return rows[0] || null
  }

  /**
   * Update claim status (only by the owner of the listing)
   */
  static async updateStatusByOwner(claimId, ownerId, status) {
    const query = `
      UPDATE claims
      SET status = $1, updated_at = NOW()
      WHERE id = $2 AND owner_id = $3
      RETURNING id, resource_id, resource_title, requester_id, requester_name, requester_email, owner_id, owner_email, status, updated_at
    `
    const { rows } = await pool.query(query, [status, claimId, ownerId])
    return rows[0] || null
  }
}
