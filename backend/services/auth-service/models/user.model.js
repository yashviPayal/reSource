import { pool } from '../config/db.js'

export class UserModel {
  /**
   * Find user by email (case-insensitive)
   */
  static async findByEmail(email) {
    const query = `
      SELECT id, name, email, password_hash, created_at, updated_at
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
    `
    const { rows } = await pool.query(query, [email.trim()])
    return rows[0] || null
  }

  /**
   * Find user by ID (excluding password hash)
   */
  static async findById(id) {
    const query = `
      SELECT id, name, email, created_at, updated_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `
    const { rows } = await pool.query(query, [id])
    return rows[0] || null
  }

  /**
   * Create a new user record
   */
  static async createUser({ name, email, passwordHash }) {
    const query = `
      INSERT INTO users (name, email, password_hash)
      VALUES ($1, LOWER($2), $3)
      RETURNING id, name, email, created_at
    `
    const { rows } = await pool.query(query, [name.trim(), email.trim(), passwordHash])
    return rows[0]
  }

  /**
   * Check if an email is already registered
   */
  static async emailExists(email) {
    const query = `
      SELECT 1 FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
    `
    const { rows } = await pool.query(query, [email.trim()])
    return rows.length > 0
  }
}
