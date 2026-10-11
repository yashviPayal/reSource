export const CATEGORIES = ['Books & Paper', 'Clothing', 'Electronics', 'Furniture', 'Household']
export const ACTIONS = ['Donate', 'Reuse', 'Repair', 'Recycle']
export const CONDITIONS = ['New', 'Like new', 'Good', 'Needs repair']

export function validateResource(body = {}) {
  const errors = []
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const category = body.category
  const action = body.action
  const condition = body.condition || 'Good'
  const location = typeof body.location === 'string' ? body.location.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  if (!title || title.length > 120) errors.push('Title is required and must be 120 characters or fewer.')
  if (!CATEGORIES.includes(category)) errors.push('Choose a valid category.')
  if (!ACTIONS.includes(action)) errors.push('Choose a valid action.')
  if (!CONDITIONS.includes(condition)) errors.push('Choose a valid condition.')
  if (!location || location.length > 120) errors.push('Location is required and must be 120 characters or fewer.')
  if (description.length > 1000) errors.push('Description must be 1000 characters or fewer.')
  return { errors, value: { title, category, action, condition, location, description } }
}

export function validateClaim(body = {}) {
  const name = typeof body.requester_name === 'string' ? body.requester_name.trim() : ''
  const email = typeof body.requester_email === 'string' ? body.requester_email.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const errors = []
  if (!name || name.length > 100) errors.push('Enter a name of 1 to 100 characters.')
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Enter a valid email address.')
  if (message.length > 500) errors.push('Message must be 500 characters or fewer.')
  return { errors, value: { name, email, message } }
}
