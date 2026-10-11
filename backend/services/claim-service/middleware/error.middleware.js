export function errorHandler(err, req, res, _next) {
  console.error('[claim-service Error]:', err.message || err)

  // Postgres unique constraint violation (user already has pending claim for this item)
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      error: 'You already have a pending request for this item.',
    })
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON request payload.',
    })
  }

  const statusCode = err.statusCode || 500
  const message = err.message || 'Internal Server Error'

  res.status(statusCode).json({
    success: false,
    error: message,
  })
}
