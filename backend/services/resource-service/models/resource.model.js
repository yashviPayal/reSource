import { pool } from '../config/db.js'

export class ResourceModel {
  /**
   * Find resources with dynamic filters and pagination
   */
  static async findAll({ category, action, location, search, status = 'available', limit = 100, offset = 0 }) {
    const conditions = []
    const values = []

    const addCondition = (sql, value) => {
      values.push(value)
      conditions.push(sql.replace('?', `$${values.length}`))
    }

    if (status && status !== 'all') {
      addCondition('status = ?', status)
    }
    if (category && category !== 'All') {
      addCondition('category = ?', category)
    }
    if (action && action !== 'All') {
      addCondition('action = ?', action)
    }
    if (location) {
      addCondition('location ILIKE ?', `%${String(location).slice(0, 120)}%`)
    }
    if (search) {
      values.push(`%${String(search).slice(0, 120)}%`)
      const n = values.length
      conditions.push(`(title ILIKE $${n} OR description ILIKE $${n} OR location ILIKE $${n} OR category ILIKE $${n})`)
    }

    const safeLimit = Math.min(Math.max(Number.parseInt(String(limit), 10) || 100, 1), 200)
    const safeOffset = Math.max(Number.parseInt(String(offset), 10) || 0, 0)

    values.push(safeLimit, safeOffset)
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const query = `
      SELECT id, title, category, action, condition, location, description, status, owner_id, owner_email, created_at
      FROM resources
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${values.length - 1} OFFSET $${values.length}
    `

    const { rows } = await pool.query(query, values)
    return rows
  }

  /**
   * Count resources matching filter conditions
   */
  static async countAll({ category, action, location, search, status = 'available' }) {
    const conditions = []
    const values = []

    const addCondition = (sql, value) => {
      values.push(value)
      conditions.push(sql.replace('?', `$${values.length}`))
    }

    if (status && status !== 'all') addCondition('status = ?', status)
    if (category && category !== 'All') addCondition('category = ?', category)
    if (action && action !== 'All') addCondition('action = ?', action)
    if (location) addCondition('location ILIKE ?', `%${String(location).slice(0, 120)}%`)
    if (search) {
      values.push(`%${String(search).slice(0, 120)}%`)
      const n = values.length
      conditions.push(`(title ILIKE $${n} OR description ILIKE $${n} OR location ILIKE $${n} OR category ILIKE $${n})`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const countQuery = `SELECT COUNT(*)::int AS count FROM resources ${whereClause}`

    const { rows } = await pool.query(countQuery, values)
    return rows[0]?.count || 0
  }

  /**
   * Find single resource by ID
   */
  static async findById(id) {
    const query = `
      SELECT id, title, category, action, condition, location, description, status, owner_id, owner_email, created_at
      FROM resources
      WHERE id = $1
      LIMIT 1
    `
    const { rows } = await pool.query(query, [id])
    return rows[0] || null
  }

  /**
   * Insert new listing
   */
  static async create({ title, category, action, condition, location, description, ownerId, ownerEmail }) {
    const query = `
      INSERT INTO resources (title, category, action, condition, location, description, owner_id, owner_email)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, title, category, action, condition, location, description, status, owner_id, owner_email, created_at
    `
    const { rows } = await pool.query(query, [
      title,
      category,
      action,
      condition,
      location,
      description,
      ownerId,
      ownerEmail,
    ])
    return rows[0]
  }

  /**
   * Delete listing if requester is the owner
   */
  static async deleteByIdAndOwner(id, ownerId) {
    const query = `
      DELETE FROM resources
      WHERE id = $1 AND owner_id = $2
      RETURNING id
    `
    const { rows } = await pool.query(query, [id, ownerId])
    return rows.length > 0
  }

  /**
   * Update status of resource (e.g. reserved or completed)
   */
  static async updateStatus(id, status) {
    const query = `
      UPDATE resources
      SET status = $1
      WHERE id = $2
      RETURNING id, status
    `
    const { rows } = await pool.query(query, [status, id])
    return rows[0] || null
  }
}
