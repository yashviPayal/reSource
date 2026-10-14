import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_replace_in_production_2026'

export function authenticateToken(req, res, next) {
  // 1. Check httpOnly cookie first
  let token = req.cookies?.token

  // 2. Fallback to Authorization: Bearer <token>
  if (!token) {
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1]
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please sign in.',
    })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    return next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Your session has expired. Please sign in again.',
      })
    }
    return res.status(401).json({
      success: false,
      error: 'Invalid authentication token.',
    })
  }
}
