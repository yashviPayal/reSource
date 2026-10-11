const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateRegister(req, res, next) {
  const { name, email, password } = req.body || {}
  const errors = []

  if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
    errors.push('Name must be between 2 and 100 characters.')
  }

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim()) || email.trim().length > 254) {
    errors.push('A valid email address is required.')
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    errors.push('Password must be at least 8 characters long.')
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: errors.join(' '),
      details: errors,
    })
  }

  next()
}

export function validateLogin(req, res, next) {
  const { email, password } = req.body || {}
  const errors = []

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    errors.push('A valid email address is required.')
  }

  if (!password || typeof password !== 'string' || !password) {
    errors.push('Password is required.')
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: errors.join(' '),
      details: errors,
    })
  }

  next()
}
