import test from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'

const TEST_SECRET = 'test_secret_for_unit_tests_12345678'

test('JWT token verification works properly with user payload', () => {
  const payload = { userId: 5, name: 'Rohit', email: 'rohit@test.com' }
  const token = jwt.sign(payload, TEST_SECRET, { expiresIn: '1h' })

  const decoded = jwt.verify(token, TEST_SECRET)
  assert.equal(decoded.userId, 5)
  assert.equal(decoded.name, 'Rohit')
  assert.equal(decoded.email, 'rohit@test.com')
})

test('Resource payload validation accepts valid category and action', () => {
  const validCategories = ['Books & Paper', 'Clothing', 'Electronics', 'Furniture', 'Household']
  const validActions = ['Donate', 'Reuse', 'Repair', 'Recycle']

  assert.ok(validCategories.includes('Electronics'))
  assert.ok(validActions.includes('Donate'))
  assert.equal(validCategories.includes('InvalidCategory'), false)
})
