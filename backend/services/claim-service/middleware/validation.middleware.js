export function validateClaimCreate(req, res, next) {
  const resourceId = req.body?.resource_id || req.params?.resourceId
  const message = req.body?.message

  const errors = []

  if (!resourceId || !/^\d+$/.test(String(resourceId))) {
    errors.push('A valid numeric resource_id is required.')
  }

  if (message && (typeof message !== 'string' || message.trim().length > 500)) {
    errors.push('Message cannot exceed 500 characters.')
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: errors.join(' '),
      details: errors,
    })
  }

  req.sanitizedClaim = {
    resourceId: Number(resourceId),
    message: typeof message === 'string' ? message.trim() : '',
  }

  next()
}

export function validateClaimStatus(req, res, next) {
  const { status } = req.body || {}
  const validStatuses = ['approved', 'rejected']

  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      error: 'Status must be either "approved" or "rejected".',
    })
  }

  next()
}
