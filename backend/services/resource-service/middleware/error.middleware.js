export function errorHandler(err, req, res, _next) {
  console.error('[resource-service Error]:', err.message || err)

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
