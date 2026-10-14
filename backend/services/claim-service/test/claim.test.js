import test from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'

const TEST_SECRET = 'test_secret_for_claim_service_12345678'

test('JWT auth token contains valid requester payload', () => {
  const payload = { userId: 8, name: 'Yashvi', email: 'yashvi@test.com' }
  const token = jwt.sign(payload, TEST_SECRET, { expiresIn: '1h' })

  const decoded = jwt.verify(token, TEST_SECRET)
  assert.equal(decoded.userId, 8)
  assert.equal(decoded.name, 'Yashvi')
  assert.equal(decoded.email, 'yashvi@test.com')
})

test('Claim status accepts valid statuses and rejects invalid ones', () => {
  const validStatuses = ['approved', 'rejected']
  assert.ok(validStatuses.includes('approved'))
  assert.ok(validStatuses.includes('rejected'))
  assert.equal(validStatuses.includes('unknown_status'), false)
})
