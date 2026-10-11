import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'auth_service_super_secret_jwt_key_2026'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

/**
 * Generate a signed JWT token with standard user payload
 */
export function generateToken(user) {
  const payload = {
    sub: String(user.id),
    userId: Number(user.id),
    name: user.name,
    email: user.email,
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

/**
 * Verify a JWT token and return decoded payload
 */
export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET)
}
