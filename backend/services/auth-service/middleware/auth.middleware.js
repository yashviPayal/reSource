import { verifyToken } from '../utils/jwt.js'

export function authenticateToken(req, res, next) {
  // 1. Check httpOnly cookie first (best practice for web clients)
  let token = req.cookies?.token

  // 2. Fallback to Authorization: Bearer <token> (for mobile apps / Postman / inter-service calls)
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
    const decoded = verifyToken(token)
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
