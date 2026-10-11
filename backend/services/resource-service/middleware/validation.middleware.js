const VALID_CATEGORIES = ['Books & Paper', 'Clothing', 'Electronics', 'Furniture', 'Household']
const VALID_ACTIONS = ['Donate', 'Reuse', 'Repair', 'Recycle']
const VALID_CONDITIONS = ['New', 'Like new', 'Good', 'Needs repair']

export function validateResource(req, res, next) {
  const { title, category, action, condition, location, description } = req.body || {}
  const errors = []

  if (!title || typeof title !== 'string' || title.trim().length < 3 || title.trim().length > 120) {
    errors.push('Title must be between 3 and 120 characters.')
  }

  if (!category || !VALID_CATEGORIES.includes(category)) {
    errors.push(`Category must be one of: ${VALID_CATEGORIES.join(', ')}.`)
  }

  if (!action || !VALID_ACTIONS.includes(action)) {
    errors.push(`Action must be one of: ${VALID_ACTIONS.join(', ')}.`)
  }

  if (condition && !VALID_CONDITIONS.includes(condition)) {
    errors.push(`Condition must be one of: ${VALID_CONDITIONS.join(', ')}.`)
  }

  if (!location || typeof location !== 'string' || location.trim().length < 2 || location.trim().length > 120) {
    errors.push('Location must be between 2 and 120 characters.')
  }

  if (description && (typeof description !== 'string' || description.trim().length > 1000)) {
    errors.push('Description cannot exceed 1000 characters.')
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: errors.join(' '),
      details: errors,
    })
  }

  // Sanitized trimmed values
  req.sanitizedResource = {
    title: title.trim(),
    category,
    action,
    condition: condition || 'Good',
    location: location.trim(),
    description: (description || '').trim(),
  }

  next()
}
