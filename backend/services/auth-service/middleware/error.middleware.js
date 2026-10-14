export function errorHandler(err, req, res, _next) {
  console.error('[auth-service Error]:', err.message || err)

  // Handle unique constraint violation in Postgres (code 23505)
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      error: 'An account with this email address already exists.',
    })
  }

  // Handle JSON parse errors
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
